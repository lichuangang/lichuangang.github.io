const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    // ========== 状态 ==========
    const currentView = ref('dashboard');
    const selectedGrade = ref(1);
    const selectedSemester = ref(1);
    const selectedCourseIdx = ref(null);
    const selectedCharIdx = ref(null);
    const selectedPoemIdx = ref(null);
    const selectedCharLibIdx = ref(null);
    const showAddCharModal = ref(false);

    // 数据
    const summaryList = ref([]);
    const curriculumData = ref({});
    const charactersData = ref({});
    const poemsData = ref({});
    const versionsData = ref({ latestVersion: '', versions: [] });

    // 版本目录管理
    const adminVersions = ref({ currentVersion: '', versions: [] });
    const showCopyModal = ref(false);
    const copySource = ref('');
    const copyTarget = ref('');

    // 搜索/筛选
    const poemFilterGrade = ref(0);
    const poemFilterSemester = ref(0);
    const poemSearch = ref('');
    const charLibSearch = ref('');

    // 添加生字 - 从生字库选择
    const addCharSearch = ref('');
    const pickedLibChar = ref(null);
    const pickedCharType = ref('writing');

    const addCharSearchResults = computed(() => {
      if (!addCharSearch.value || !charactersData.value.characters) return [];
      const q = addCharSearch.value.toLowerCase();
      return charactersData.value.characters.filter(ch =>
        ch.char.includes(q) || ch.pinyin.toLowerCase().includes(q)
      ).slice(0, 20);
    });

    // 通知
    const toast = reactive({ show: false, message: '', type: 'success' });

    // 自动保存
    const autoSaveTimers = {};
    const skipAutoSave = new Set();
    const autoSaveStatus = ref(''); // '', 'saving', 'saved', 'error'

    // ========== 计算属性 ==========
    const totalCourses = computed(() => summaryList.value.reduce((s, v) => s + v.courseCount, 0));
    const totalChars = computed(() => summaryList.value.reduce((s, v) => s + v.characterCount, 0));

    const editingCourse = computed(() => {
      if (selectedCourseIdx.value === null || !curriculumData.value.courses) return null;
      return curriculumData.value.courses[selectedCourseIdx.value];
    });

    const editingCourseChars = computed(() => {
      const course = editingCourse.value;
      if (!course || !course.charIds || !curriculumData.value.characters) return [];
      return course.charIds
        .map(id => curriculumData.value.characters[id])
        .filter(Boolean);
    });

    const editingChar = computed(() => {
      if (selectedCharIdx.value === null) return null;
      return editingCourseChars.value[selectedCharIdx.value] || null;
    });

    const filteredPoems = computed(() => {
      if (!poemsData.value.poems) return [];
      return poemsData.value.poems.filter(p => {
        if (poemFilterGrade.value && p.grade !== poemFilterGrade.value) return false;
        if (poemFilterSemester.value && p.semester !== poemFilterSemester.value) return false;
        if (poemSearch.value) {
          const q = poemSearch.value.toLowerCase();
          return p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q);
        }
        return true;
      });
    });

    const editingPoem = computed(() => {
      if (selectedPoemIdx.value === null || !filteredPoems.value.length) return null;
      return filteredPoems.value[selectedPoemIdx.value] || null;
    });

    const filteredCharLib = computed(() => {
      if (!charactersData.value.characters) return [];
      if (!charLibSearch.value) return charactersData.value.characters;
      const q = charLibSearch.value.toLowerCase();
      return charactersData.value.characters.filter(ch =>
        ch.char.includes(q) || ch.pinyin.toLowerCase().includes(q) ||
        (ch.meaning && ch.meaning.toLowerCase().includes(q))
      );
    });

    const editingCharLib = computed(() => {
      if (selectedCharLibIdx.value === null) return null;
      return filteredCharLib.value[selectedCharLibIdx.value] || null;
    });

    // ========== 方法 ==========

    function showToast(message, type = 'success') {
      toast.message = message;
      toast.type = type;
      toast.show = true;
      setTimeout(() => { toast.show = false; }, 2500);
    }

    function scheduleAutoSave(key, saveFn) {
      if (skipAutoSave.has(key)) { skipAutoSave.delete(key); return; }
      if (autoSaveTimers[key]) clearTimeout(autoSaveTimers[key]);
      autoSaveTimers[key] = setTimeout(async () => {
        try {
          autoSaveStatus.value = 'saving';
          await saveFn();
          autoSaveStatus.value = 'saved';
          setTimeout(() => { if (autoSaveStatus.value === 'saved') autoSaveStatus.value = ''; }, 2000);
        } catch(e) {
          autoSaveStatus.value = 'error';
          showToast('自动保存失败: ' + e.message, 'error');
        }
      }, 1000);
    }

    function getSummary(grade, semester) {
      return summaryList.value.find(s => s.grade === grade && s.semester === semester);
    }

    // 视图切换
    function switchView(view) {
      currentView.value = view;
      selectedCourseIdx.value = null;
      selectedCharIdx.value = null;
      selectedPoemIdx.value = null;
      selectedCharLibIdx.value = null;

      if (view === 'characters' && (!charactersData.value.characters || !charactersData.value.characters.length)) {
        loadCharacters();
      }
      if (view === 'poems' && (!poemsData.value.poems || !poemsData.value.poems.length)) {
        loadPoems();
      }
      if (view === 'versions') {
        loadAdminVersions();
        loadVersions();
      }
    }

    // 加载数据
    async function loadSummary() {
      try {
        summaryList.value = await API.getCurriculumSummary();
      } catch (e) {
        showToast('加载概要失败: ' + e.message, 'error');
      }
    }

    async function loadCurriculum(grade, semester) {
      try {
        selectedGrade.value = grade;
        selectedSemester.value = semester;
        currentView.value = 'curriculum';
        selectedCourseIdx.value = null;
        selectedCharIdx.value = null;
        skipAutoSave.add('curriculum');
        curriculumData.value = await API.getCurriculum(grade, semester);
      } catch (e) {
        showToast('加载课程失败: ' + e.message, 'error');
      }
    }

    async function loadCharacters() {
      try {
        skipAutoSave.add('characters');
        charactersData.value = await API.getCharacters();
      } catch (e) {
        showToast('加载生字库失败: ' + e.message, 'error');
      }
    }

    async function loadPoems() {
      try {
        skipAutoSave.add('poems');
        poemsData.value = await API.getPoems();
      } catch (e) {
        showToast('加载古诗文失败: ' + e.message, 'error');
      }
    }

    async function loadVersions() {
      try {
        skipAutoSave.add('versions');
        versionsData.value = await API.getVersions();
      } catch (e) {
        showToast('加载版本信息失败: ' + e.message, 'error');
      }
    }

    // 版本目录管理
    async function loadAdminVersions() {
      try {
        adminVersions.value = await API.getAdminVersions();
      } catch (e) {
        showToast('加载版本列表失败: ' + e.message, 'error');
      }
    }

    async function doSwitchVersion(versionName) {
      if (versionName === adminVersions.value.currentVersion) {
        showToast('已经是当前版本', 'error');
        return;
      }
      if (!confirm(`确定要切换到版本 "${versionName}" 吗？\n切换后所有数据操作将基于新版本目录。`)) return;
      try {
        const result = await API.switchVersion(versionName);
        if (result.success) {
          showToast(`已切换到版本: ${versionName}`);
          // 重新加载所有数据
          await Promise.all([loadAdminVersions(), loadSummary(), loadCharacters(), loadPoems()]);
          if (currentView.value === 'versions') {
            await loadVersions();
          }
        } else {
          showToast(result.error || '切换失败', 'error');
        }
      } catch (e) {
        showToast('切换版本失败: ' + e.message, 'error');
      }
    }

    function openCopyModal(sourceName) {
      copySource.value = sourceName;
      // 自动生成目标版本名
      const match = sourceName.match(/^v(\d+)\.(\d+)\.(\d+)$/);
      if (match) {
        const patch = parseInt(match[3]) + 1;
        copyTarget.value = `v${match[1]}.${match[2]}.${patch}`;
      } else {
        copyTarget.value = sourceName + '_copy';
      }
      showCopyModal.value = true;
    }

    function closeCopyModal() {
      showCopyModal.value = false;
      copySource.value = '';
      copyTarget.value = '';
    }

    async function doCopyVersion() {
      if (!copyTarget.value) {
        showToast('请输入新版本名称', 'error');
        return;
      }
      if (!/^v\d/.test(copyTarget.value)) {
        showToast('版本名称必须以 v 开头，如 v1.1.0', 'error');
        return;
      }
      try {
        const result = await API.copyVersion(copySource.value, copyTarget.value);
        if (result.success) {
          showToast(result.message);
          closeCopyModal();
          await loadAdminVersions();
        } else {
          showToast(result.error || '复制失败', 'error');
        }
      } catch (e) {
        showToast('复制版本失败: ' + e.message, 'error');
      }
    }

    // 刷新全部数据
    async function refreshData() {
      await loadSummary();
      if (currentView.value === 'curriculum') {
        await loadCurriculum(selectedGrade.value, selectedSemester.value);
      } else if (currentView.value === 'characters') {
        await loadCharacters();
      } else if (currentView.value === 'poems') {
        await loadPoems();
      } else if (currentView.value === 'versions') {
        await loadVersions();
      }
      showToast('数据已刷新');
    }

    // 保存当前数据
    async function saveCurrentData() {
      try {
        if (currentView.value === 'curriculum' && curriculumData.value.courses) {
          await API.saveCurriculum(selectedGrade.value, selectedSemester.value, curriculumData.value);
          showToast(`${selectedGrade.value}年级${selectedSemester.value === 1 ? '上' : '下'}册课程已保存`);
        } else if (currentView.value === 'characters') {
          await API.saveCharacters(charactersData.value);
          showToast('生字库已保存');
        } else if (currentView.value === 'poems') {
          await API.savePoems(poemsData.value);
          showToast('古诗文已保存');
        } else if (currentView.value === 'versions') {
          await API.saveVersions(versionsData.value);
          showToast('版本信息已保存');
        } else {
          showToast('请先选择要保存的内容', 'error');
          return;
        }
        await loadSummary();
      } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
      }
    }

    // ========== 课程操作 ==========

    function selectCourse(idx) {
      selectedCourseIdx.value = idx;
      selectedCharIdx.value = null;
    }

    function closeCourseModal() {
      selectedCourseIdx.value = null;
      selectedCharIdx.value = null;
    }

    function addCourse() {
      if (!curriculumData.value.courses) {
        curriculumData.value.courses = [];
      }
      const g = selectedGrade.value;
      const s = selectedSemester.value;
      const prefix = `g${g}${s === 1 ? 's' : 'x'}`;
      const num = curriculumData.value.courses.length + 1;
      const newCourse = {
        id: `${prefix}_c${num}`,
        grade: g,
        semester: s,
        courseNumber: num,
        title: `新课程${num}`,
        subtitle: null,
        charIds: []
      };
      curriculumData.value.courses.push(newCourse);
      selectedCourseIdx.value = curriculumData.value.courses.length - 1;
      selectedCharIdx.value = null;
    }

    function deleteCourse(idx) {
      if (!confirm('确定要删除这个课程吗？关联的生字数据不会被删除。')) return;
      curriculumData.value.courses.splice(idx, 1);
      if (selectedCourseIdx.value === idx) {
        selectedCourseIdx.value = null;
        selectedCharIdx.value = null;
      } else if (selectedCourseIdx.value > idx) {
        selectedCourseIdx.value--;
      }
    }

    function moveCourse(idx, direction) {
      const courses = curriculumData.value.courses;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= courses.length) return;
      const temp = courses[idx];
      courses[idx] = courses[newIdx];
      courses[newIdx] = temp;
      // 更新选中索引
      if (selectedCourseIdx.value === idx) {
        selectedCourseIdx.value = newIdx;
      } else if (selectedCourseIdx.value === newIdx) {
        selectedCourseIdx.value = idx;
      }
      // 强制触发响应式更新
      curriculumData.value.courses = [...courses];
    }

    // ========== 生字操作(课程内) ==========

    function selectChar(idx) {
      selectedCharIdx.value = idx;
    }

    function updateStrokeOrder(val) {
      if (editingChar.value) {
        editingChar.value.strokeOrder = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    function updateWords(val) {
      if (editingChar.value) {
        editingChar.value.words = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    function deleteCharFromCourse() {
      const course = editingCourse.value;
      const ch = editingChar.value;
      if (!course || !ch) return;
      if (!confirm(`确定要从本课移除"${ch.char}"吗？`)) return;
      const idx = course.charIds.indexOf(ch.id);
      if (idx > -1) {
        course.charIds.splice(idx, 1);
      }
      // 同时删除 characters 中的详情数据
      if (curriculumData.value.characters && curriculumData.value.characters[ch.id]) {
        delete curriculumData.value.characters[ch.id];
      }
      selectedCharIdx.value = null;
    }

    function pickLibChar(ch) {
      pickedLibChar.value = ch;
      // 根据生字库的 requiresWriting 自动设置类型
      pickedCharType.value = ch.requiresWriting ? 'writing' : 'reading';
    }
    
    function isCharInCourse(charStr) {
      const course = editingCourse.value;
      if (!course || !course.charIds || !curriculumData.value.characters) return false;
      return course.charIds.some(id => {
        const ch = curriculumData.value.characters[id];
        return ch && ch.char === charStr;
      });
    }
    
    function closeAddCharModal() {
      showAddCharModal.value = false;
      addCharSearch.value = '';
      pickedLibChar.value = null;
      pickedCharType.value = 'writing';
    }
    
    function confirmAddCharFromLib() {
      const course = editingCourse.value;
      const libChar = pickedLibChar.value;
      if (!course) { showToast('请先选择课程', 'error'); return; }
      if (!libChar) { showToast('请先选择一个生字', 'error'); return; }
    
      const g = selectedGrade.value;
      const s = selectedSemester.value;
      const prefix = `g${g}${s === 1 ? 's' : 'x'}`;
    
      // 生成生字ID
      if (!curriculumData.value.characters) {
        curriculumData.value.characters = {};
      }
      const existingIds = Object.keys(curriculumData.value.characters);
      let maxNum = 0;
      existingIds.forEach(id => {
        const match = id.match(/_(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
      });
      const charId = `${prefix}_${String(maxNum + 1).padStart(3, '0')}`;
    
      // 从生字库信息构建课程生字对象
      const charObj = {
        id: charId,
        char: libChar.char,
        pinyin: libChar.pinyin,
        grade: g,
        semester: s,
        courseId: course.id,
        type: pickedCharType.value,
        strokes: libChar.strokes || 1,
        strokeOrder: [],
        words: libChar.words ? [...libChar.words] : [],
        meaning: libChar.meaning || '',
        mnemonic: libChar.mnemonic || '',
        order: course.charIds.length + 1
      };
    
      curriculumData.value.characters[charId] = charObj;
      course.charIds.push(charId);
    
      showToast(`生字"${charObj.char}"已添加到本课`);
      closeAddCharModal();
    }

    // ========== 古诗文操作 ==========

    function selectPoem(idx) {
      selectedPoemIdx.value = idx;
    }

    function addPoem() {
      if (!poemsData.value.poems) {
        poemsData.value.poems = [];
      }
      const num = poemsData.value.poems.length + 1;
      const newPoem = {
        id: `new_${Date.now()}`,
        title: '新古诗',
        author: '',
        dynasty: '',
        content: '',
        translation: '',
        notes: '',
        difficulty: 1,
        level: 1,
        grade: 1,
        semester: 1
      };
      poemsData.value.poems.push(newPoem);
      // 重置筛选以便看到新添加的
      poemFilterGrade.value = 0;
      poemFilterSemester.value = 0;
      poemSearch.value = '';
      nextTick(() => {
        selectedPoemIdx.value = filteredPoems.value.length - 1;
      });
      showToast('新古诗已添加，请编辑详情');
    }

    function deletePoem(idx) {
      const poem = filteredPoems.value[idx];
      if (!poem) return;
      if (!confirm(`确定要删除"${poem.title}"吗？`)) return;
      const realIdx = poemsData.value.poems.indexOf(poem);
      if (realIdx > -1) {
        poemsData.value.poems.splice(realIdx, 1);
      }
      if (selectedPoemIdx.value === idx) {
        selectedPoemIdx.value = null;
      }
    }

    // ========== 生字库操作 ==========

    function selectCharLib(idx) {
      selectedCharLibIdx.value = idx;
    }

    function addCharToLib() {
      if (!charactersData.value.characters) {
        charactersData.value.characters = [];
      }
      const newCh = {
        char: '新',
        pinyin: 'xīn',
        meaning: '',
        words: [],
        strokes: 1,
        requiresWriting: true,
        mnemonic: ''
      };
      charactersData.value.characters.push(newCh);
      charLibSearch.value = '';
      nextTick(() => {
        selectedCharLibIdx.value = filteredCharLib.value.length - 1;
      });
      showToast('新生字已添加，请编辑详情');
    }

    function deleteCharFromLib(idx) {
      const ch = filteredCharLib.value[idx];
      if (!ch) return;
      if (!confirm(`确定要删除"${ch.char}"吗？`)) return;
      const realIdx = charactersData.value.characters.indexOf(ch);
      if (realIdx > -1) {
        charactersData.value.characters.splice(realIdx, 1);
      }
      if (selectedCharLibIdx.value === idx) {
        selectedCharLibIdx.value = null;
      }
    }

    function updateCharLibWords(val) {
      if (editingCharLib.value) {
        editingCharLib.value.words = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // ========== 自动保存 watchers ==========
    watch(curriculumData, () => {
      if (curriculumData.value.courses) {
        const g = selectedGrade.value;
        const s = selectedSemester.value;
        const data = curriculumData.value;
        scheduleAutoSave('curriculum', () => API.saveCurriculum(g, s, data));
      }
    }, { deep: true });

    watch(charactersData, () => {
      if (charactersData.value.characters) {
        scheduleAutoSave('characters', () => API.saveCharacters(charactersData.value));
      }
    }, { deep: true });

    watch(poemsData, () => {
      if (poemsData.value.poems) {
        scheduleAutoSave('poems', () => API.savePoems(poemsData.value));
      }
    }, { deep: true });

    watch(versionsData, () => {
      if (versionsData.value.versions) {
        scheduleAutoSave('versions', () => API.saveVersions(versionsData.value));
      }
    }, { deep: true });

    // ========== 初始化 ==========
    onMounted(async () => {
      await Promise.all([loadAdminVersions(), loadSummary(), loadCharacters(), loadPoems()]);
    });

    return {
      // 状态
      currentView, selectedGrade, selectedSemester,
      selectedCourseIdx, selectedCharIdx, selectedPoemIdx, selectedCharLibIdx,
      showAddCharModal,
      // 版本目录管理
      adminVersions, showCopyModal, copySource, copyTarget,
      // 数据
      summaryList, curriculumData, charactersData, poemsData, versionsData,
      // 搜索筛选
      poemFilterGrade, poemFilterSemester, poemSearch, charLibSearch,
      addCharSearch, pickedLibChar, pickedCharType, addCharSearchResults,
      // 通知 & 自动保存状态
      toast, autoSaveStatus,
      // 计算属性
      totalCourses, totalChars,
      editingCourse, editingCourseChars, editingChar,
      filteredPoems, editingPoem,
      filteredCharLib, editingCharLib,
      // 方法
      getSummary, switchView, refreshData, saveCurrentData,
      loadCurriculum,
      selectCourse, closeCourseModal, addCourse, deleteCourse, moveCourse,
      selectChar, updateStrokeOrder, updateWords,
      deleteCharFromCourse, pickLibChar, isCharInCourse, closeAddCharModal, confirmAddCharFromLib,
      selectPoem, addPoem, deletePoem,
      selectCharLib, addCharToLib, deleteCharFromLib, updateCharLibWords,
      // 版本目录管理
      loadAdminVersions, doSwitchVersion, openCopyModal, closeCopyModal, doCopyVersion
    };
  }
});

app.mount('#app');
