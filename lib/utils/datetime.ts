/**
 * 日期时间工具类
 * 提供统一的日期时间处理函数,消除代码重复
 */

export class DateTimeUtils {
  /**
   * 获取当前时间的 HH:mm 格式字符串
   *
   * @returns 格式化的时间字符串,如 "09:30"
   *
   * @example
   * const currentTime = DateTimeUtils.getCurrentTime();
   * // => "14:25"
   */
  static getCurrentTime(): string {
    const now = new Date();
    return this.formatTime(now);
  }

  /**
   * 将Date对象格式化为 HH:mm 字符串
   *
   * @param date - 要格式化的日期对象
   * @returns 格式化的时间字符串
   *
   * @example
   * const date = new Date('2024-01-04T14:30:00');
   * const time = DateTimeUtils.formatTime(date);
   * // => "14:30"
   */
  static formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 获取指定日期的当天开始时间 (00:00:00.000)
   *
   * @param date - 参考日期,默认为当前时间
   * @returns 当天开始时间的Date对象
   *
   * @example
   * const todayStart = DateTimeUtils.getStartOfDay();
   * // => 2024-01-04T00:00:00.000Z
   */
  static getStartOfDay(date: Date = new Date()): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * 获取指定日期所在周的开始时间 (周日 00:00:00.000)
   *
   * @param date - 参考日期,默认为当前时间
   * @returns 本周开始时间的Date对象
   *
   * @example
   * const weekStart = DateTimeUtils.getStartOfWeek();
   * // => 上个周日的 00:00:00
   */
  static getStartOfWeek(date: Date = new Date()): Date {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * 检查当前时间是否在指定范围内
   * 支持跨午夜的时间段 (如 23:30-08:00)
   *
   * @param current - 当前时间字符串 (HH:mm)
   * @param start - 开始时间字符串 (HH:mm)
   * @param end - 结束时间字符串 (HH:mm)
   * @returns 是否在时间范围内
   *
   * @example
   * // 正常范围 (08:00-23:30)
   * DateTimeUtils.isTimeInRange('10:00', '08:00', '23:30');
   * // => true
   *
   * // 跨午夜范围 (23:30-08:00)
   * DateTimeUtils.isTimeInRange('02:00', '23:30', '08:00');
   * // => true
   */
  static isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    if (startMinutes < endMinutes) {
      // 正常时间范围 (如 08:00-23:30)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // 跨午夜时间范围 (如 23:30-08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * 将时间字符串转换为分钟数 (从00:00开始计算)
   *
   * @param time - 时间字符串 (HH:mm)
   * @returns 分钟数
   *
   * @example
   * DateTimeUtils.timeToMinutes('14:30');
   * // => 870 (14 * 60 + 30)
   */
  static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 检查两个日期是否在同一天
   *
   * @param date1 - 第一个日期
   * @param date2 - 第二个日期
   * @returns 是否在同一天
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   *
   * @param date - 要格式化的日期
   * @returns 格式化的日期字符串
   */
  static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
   *
   * @param date - 要格式化的日期时间
   * @returns 格式化的日期时间字符串
   */
  static formatDateTime(date: Date): string {
    const datePart = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${datePart} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 计算两个日期之间的天数差
   *
   * @param date1 - 第一个日期
   * @param date2 - 第二个日期
   * @returns 天数差 (可能为负数)
   */
  static daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000; // 一天的毫秒数
    const diffMs = date2.getTime() - date1.getTime();
    return Math.floor(diffMs / oneDay);
  }

  /**
   * 添加指定天数到日期
   *
   * @param date - 原始日期
   * @param days - 要添加的天数 (可以为负数)
   * @returns 新的日期对象
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * 添加指定小时数到日期
   *
   * @param date - 原始日期
   * @param hours - 要添加的小时数
   * @returns 新的日期对象
   */
  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }
}
