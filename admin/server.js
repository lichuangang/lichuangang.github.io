const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 数据目录 (可切换版本)
const STATIC_DIR = path.join(__dirname, '..', 'static');
let currentVersion = 'v1.0.0';
let DATA_DIR = path.join(STATIC_DIR, currentVersion);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== 版本目录管理 API ==========

// 获取所有版本目录列表 + 当前版本
app.get('/api/admin/versions', (req, res) => {
  try {
    const dirs = fs.readdirSync(STATIC_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('v'))
      .map(d => {
        const vDir = path.join(STATIC_DIR, d.name);
        const stat = fs.statSync(vDir);
        const files = fs.readdirSync(vDir).filter(f => f.endsWith('.json'));
        // 尝试读取 versions.json 获取版本描述
        let versionInfo = null;
        const vPath = path.join(vDir, 'versions.json');
        if (fs.existsSync(vPath)) {
          try { versionInfo = JSON.parse(fs.readFileSync(vPath, 'utf-8')); } catch(e) {}
        }
        return {
          name: d.name,
          fileCount: files.length,
          modifiedAt: stat.mtime.toISOString(),
          isCurrent: d.name === currentVersion,
          latestVersion: versionInfo ? versionInfo.latestVersion : d.name
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ currentVersion, versions: dirs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 切换当前版本
app.post('/api/admin/versions/switch', (req, res) => {
  try {
    const { version } = req.body;
    if (!version) return res.status(400).json({ error: '请指定版本名称' });
    const targetDir = path.join(STATIC_DIR, version);
    if (!fs.existsSync(targetDir)) return res.status(404).json({ error: `版本目录 ${version} 不存在` });
    currentVersion = version;
    DATA_DIR = path.join(STATIC_DIR, currentVersion);
    console.log(`  🔄 已切换到版本: ${currentVersion}, 数据目录: ${DATA_DIR}`);
    res.json({ success: true, currentVersion, dataDir: DATA_DIR });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 复制版本（整个目录复制）
app.post('/api/admin/versions/copy', (req, res) => {
  try {
    const { source, target } = req.body;
    if (!source || !target) return res.status(400).json({ error: '请指定源版本和目标版本名称' });
    const sourceDir = path.join(STATIC_DIR, source);
    const targetDir = path.join(STATIC_DIR, target);
    if (!fs.existsSync(sourceDir)) return res.status(404).json({ error: `源版本 ${source} 不存在` });
    if (fs.existsSync(targetDir)) return res.status(409).json({ error: `目标版本 ${target} 已存在` });
    // 递归复制目录
    copyDirSync(sourceDir, targetDir);
    console.log(`  📋 已复制版本: ${source} → ${target}`);
    res.json({ success: true, message: `版本 ${source} 已复制为 ${target}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 递归复制目录
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ========== 工具函数 ==========

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function getCurriculumFilename(grade, semester) {
  return `curriculum_grade${grade}_semester${semester}.json`;
}

// ========== 课程 API ==========

// 获取所有年级学期的概要信息（必须放在参数路由前面）
app.get('/api/curriculum/summary', (req, res) => {
  try {
    const summary = [];
    for (let grade = 1; grade <= 6; grade++) {
      for (let semester = 1; semester <= 2; semester++) {
        const filename = getCurriculumFilename(grade, semester);
        const filePath = path.join(DATA_DIR, filename);
        if (fs.existsSync(filePath)) {
          const data = readJSON(filename);
          summary.push({
            grade,
            semester,
            courseCount: data.courses ? data.courses.length : 0,
            characterCount: data.characters ? Object.keys(data.characters).length : 0,
            version: data.version
          });
        }
      }
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取某年级某学期的课程数据
app.get('/api/curriculum/:grade/:semester', (req, res) => {
  try {
    const { grade, semester } = req.params;
    const filename = getCurriculumFilename(grade, semester);
    const data = readJSON(filename);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存某年级某学期的课程数据
app.put('/api/curriculum/:grade/:semester', (req, res) => {
  try {
    const { grade, semester } = req.params;
    const filename = getCurriculumFilename(grade, semester);
    writeJSON(filename, req.body);
    res.json({ success: true, message: '课程数据已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== 生字库 API ==========

// 获取独立生字库
app.get('/api/characters', (req, res) => {
  try {
    const data = readJSON('characters.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存独立生字库
app.put('/api/characters', (req, res) => {
  try {
    writeJSON('characters.json', req.body);
    res.json({ success: true, message: '生字库已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== 古诗文 API ==========

// 获取古诗文
app.get('/api/poems', (req, res) => {
  try {
    const data = readJSON('poems.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存古诗文
app.put('/api/poems', (req, res) => {
  try {
    writeJSON('poems.json', req.body);
    res.json({ success: true, message: '古诗文已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== 版本 API ==========

// 获取版本信息
app.get('/api/versions', (req, res) => {
  try {
    const data = readJSON('versions.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存版本信息
app.put('/api/versions', (req, res) => {
  try {
    writeJSON('versions.json', req.body);
    res.json({ success: true, message: '版本信息已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== 启动服务器 ==========

app.listen(PORT, () => {
  console.log(`\n  ✅ 小学语文课程资源管理系统已启动`);
  console.log(`  🌐 访问地址: http://localhost:${PORT}`);
  console.log(`  📁 当前版本: ${currentVersion}`);
  console.log(`  📁 数据目录: ${DATA_DIR}\n`);
});
