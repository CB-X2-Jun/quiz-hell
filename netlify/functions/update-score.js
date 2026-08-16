// netlify/functions/update-score.js
const fetch = require('node-fetch'); // Netlify 环境自带，无需安装

exports.handler = async (event) => {
  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { ip, score } = JSON.parse(event.body);
    if (!ip || score === undefined || score < 0) {
      return { statusCode: 400, body: 'Invalid data' };
    }

    // 从环境变量读取 Token
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { statusCode: 500, body: 'Token not configured' };
    }

    // 您的仓库信息
    const owner = 'YOUR_USERNAME';
    const repo = 'YOUR_REPO';
    const branch = 'main';
    const filePath = 'rank.txt';

    // 1. 获取当前 rank.txt 的内容和 SHA
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let content = '';
    let sha = null;
    if (getRes.status === 200) {
      const data = await getRes.json();
      content = Buffer.from(data.content, 'base64').toString('utf-8');
      sha = data.sha;
    } else if (getRes.status !== 404) {
      // 其他错误
      return { statusCode: 500, body: 'Failed to read rank.txt' };
    }

    // 2. 解析并更新排行榜
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const entries = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return { ip: parts[0], score: parseInt(parts[1], 10) };
    });

    let updated = false;
    const existing = entries.find(e => e.ip === ip);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        updated = true;
      }
    } else {
      entries.push({ ip, score });
      updated = true;
    }

    if (!updated) {
      // 分数没有提高，无需更新
      return { statusCode: 200, body: JSON.stringify({ message: 'Score not improved' }) };
    }

    // 排序：降序，同分保持原顺序
    entries.sort((a, b) => b.score - a.score);
    const newContent = entries.map(e => `${e.ip} ${e.score}`).join('\n');

    // 3. 写回 GitHub
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: 'Update leaderboard',
        content: Buffer.from(newContent).toString('base64'),
        sha: sha,
        branch: branch,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return { statusCode: 500, body: JSON.stringify({ error: err }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
