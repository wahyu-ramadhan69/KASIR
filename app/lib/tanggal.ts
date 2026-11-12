// Helper tanggal berbasis zona waktu WIB (Asia/Jakarta)

/** Tanggal hari ini dalam WIB, format YYYY-MM-DD */
export function getTodayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

/** Jam 00:00 hari ini dalam WIB */
export function getStartOfTodayWIB(): Date {
  return new Date(`${getTodayWIB()}T00:00:00+07:00`);
}

/** true jika tanggal berada sebelum hari ini (WIB) */
export function isBeforeTodayWIB(date: Date | string): boolean {
  return new Date(date).getTime() < getStartOfTodayWIB().getTime();
}
