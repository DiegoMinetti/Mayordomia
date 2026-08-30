var DriveProvider = (function () {
  function health() { var id = AppConfig.get(AppConfig.KEYS.rootFolderId); if (!id) return { status: 'NOT_CONFIGURED' }; try { var folder = DriveApp.getFolderById(id); return { status: 'OK', name: folder.getName() }; } catch (e) { return { status: 'ERROR' }; } }
  function createFile(parentId, name, blob) { return DriveApp.getFolderById(parentId).createFile(blob).setName(name).getId(); }
  return { health: health, createFile: createFile };
})();
