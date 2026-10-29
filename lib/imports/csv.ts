// CSV records can span lines (for example a Google Contacts Notes cell).
export function parseCsv(text: string): string[][] {
  const rows: string[][]=[]
  let row: string[]=[],cell='',quoted=false
  const input=text.replace(/^\uFEFF/,'')
  const finishRow=()=>{row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell=''}
  for(let index=0;index<input.length;index++) {
    const char=input[index]
    if(char==='"') {
      if(quoted&&input[index+1]==='"'){cell+='"';index++}
      else if(quoted||cell.length===0)quoted=!quoted
      else cell+=char
    } else if(char===','&&!quoted){row.push(cell);cell=''}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&input[index+1]==='\n')index++;finishRow()}
    else cell+=char
  }
  if(quoted)throw new Error('The CSV contains an unclosed quoted field. Please export it again.')
  if(cell.length||row.length)finishRow()
  return rows
}
