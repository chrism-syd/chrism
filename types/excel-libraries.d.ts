declare module 'read-excel-file' {
  export default function readXlsxFile(file: File | Blob): Promise<unknown[][]>
}

declare module 'write-excel-file' {
  type Cell = {
    value: string | number | boolean | Date | null
    fontWeight?: 'bold'
  }

  export default function writeXlsxFile(
    data: Cell[][],
    options?: {
      sheet?: string
      buffer?: false
    }
  ): Promise<Blob>
}
