// API 调用封装
const API = {
  // 课程相关
  async getCurriculumSummary() {
    const res = await fetch('/api/curriculum/summary');
    return res.json();
  },

  async getCurriculum(grade, semester) {
    const res = await fetch(`/api/curriculum/${grade}/${semester}`);
    return res.json();
  },

  async saveCurriculum(grade, semester, data) {
    const res = await fetch(`/api/curriculum/${grade}/${semester}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 生字库相关
  async getCharacters() {
    const res = await fetch('/api/characters');
    return res.json();
  },

  async saveCharacters(data) {
    const res = await fetch('/api/characters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 古诗文相关
  async getPoems() {
    const res = await fetch('/api/poems');
    return res.json();
  },

  async savePoems(data) {
    const res = await fetch('/api/poems', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 版本相关
  async getVersions() {
    const res = await fetch('/api/versions');
    return res.json();
  },

  async saveVersions(data) {
    const res = await fetch('/api/versions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // 版本目录管理
  async getAdminVersions() {
    const res = await fetch('/api/admin/versions');
    return res.json();
  },

  async switchVersion(version) {
    const res = await fetch('/api/admin/versions/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version })
    });
    return res.json();
  },

  async copyVersion(source, target) {
    const res = await fetch('/api/admin/versions/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target })
    });
    return res.json();
  }
};
