var CalendarProvider = (function () {
  function health() { var id = AppConfig.get(AppConfig.KEYS.calendarId); if (!id) return { status: 'NOT_CONFIGURED' }; try { var calendar = CalendarApp.getCalendarById(id); return calendar ? { status: 'OK', name: calendar.getName() } : { status: 'ERROR' }; } catch (e) { return { status: 'ERROR' }; } }
  function upsert(event) {
    var calendar = CalendarApp.getCalendarById(AppConfig.requireValue(AppConfig.KEYS.calendarId));
    if (event.calendarEventId) { var existing = calendar.getEventById(event.calendarEventId); if (existing) { existing.setTitle(event.title).setTime(event.start, event.end); return existing.getId(); } }
    return calendar.createEvent(event.title, event.start, event.end, { description: event.description || '' }).getId();
  }
  return { health: health, upsert: upsert };
})();
