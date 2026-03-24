declare module 'xlsx' {
  export type WorkSheet = unknown
  export type WorkBook = unknown

  export function read(data: ArrayBuffer, opts?: Record<string, unknown>): {
    SheetNames: string[]
    Sheets: Record<string, unknown>
  }

  export function writeFile(workbook: WorkBook, filename: string, opts?: Record<string, unknown>): void

  export const utils: {
    sheet_to_json<T = unknown>(sheet: unknown, opts?: Record<string, unknown>): T
    json_to_sheet(data: Record<string, unknown>[], opts?: Record<string, unknown>): WorkSheet
    book_new(): WorkBook
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name: string): void
  }
}
