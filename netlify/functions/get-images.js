// netlify/functions/get-images.js
const fetch = require('node-fetch'); // 如果使用 Node 18+，可直接用全局 fetch

exports.handler = async (event) => {
  // 只允许 GET 请求
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, body: 'Token not configured' };
  }

  const owner = 'CB-X2-Jun';
  const repo = 'quiz-hell';
  const branch = 'main';
  const zones = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'Z']; // 您实际存在的目录

  const results = {};

  for (const zone of zones) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/characters/${zone}?ref=${branch}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!res.ok) {
        console.warn(`Zone ${zone} 获取失败: ${res.status}`);
        results[zone] = [];
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        results[zone] = [];
        continue;
      }
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.jpe', '.jfif', '.tif', '.tiff'];
      const files = data
        .filter(item => item.type === 'file')
        .filter(item => imageExts.some(ext => item.name.toLowerCase().endsWith(ext)))
        .map(item => ({
          path: item.path,
          // 注意：这里我们返回原始 download_url，前端会自行添加代理前缀
          url: item.download_url,
          zone: zone,
          name: item.name,
        }));
      results[zone] = files;
    } catch (e) {
      console.error(`Zone ${zone} 错误:`, e);
      results[zone] = [];
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};
