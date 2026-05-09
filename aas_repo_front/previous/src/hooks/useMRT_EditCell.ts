import { MRT_Cell, MRT_Column, MRT_Row, MRT_RowData, MRT_TableInstance } from 'mantine-react-table'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { MRT_ColumnDefExtend } from '@/components/CustomMantineReactTable'
import { getValue, hasRowChanged } from '@/utils/mrt'

export type MantineTableCellProps = {
  cell: MRT_Cell<MRT_RowData>
  column: MRT_Column<MRT_RowData>
  row: MRT_Row<MRT_RowData>
  table: MRT_TableInstance<MRT_RowData>
}

// 새로운 타입을 확장하여 `setEditingRow` 추가
export type EditableTableCellProps = MantineTableCellProps & {
  setEditedRows: React.Dispatch<React.SetStateAction<Record<string, MRT_Row<MRT_RowData>>>>
}

export function useMRT_EditCell(props: MantineTableCellProps | EditableTableCellProps) {
  const { cell, column, row, table } = props

  // const { getState, setEditingCell, setEditingRow, setCreatingRow } = table
  // const { editingRow, creatingRow } = getState()

  const cellValue = getValue(cell)
  const [value, setValue] = useState(cellValue)

  // 테이블 데이터 최신화할 경우 state 값 초기화
  useEffect(() => {
    setValue(cellValue)
  }, [cell, cellValue])

  // const isCreating = creatingRow?.id === row.id
  // const isEditing = editingRow?.id === row.id

  const columnDef = column.columnDef as MRT_ColumnDefExtend

  const handleOnChange = (e) => {
    let newValue
    if (e == null) newValue = ''
    else if (e.target == null) newValue = e
    else newValue = e.target.value

    console.log({ newValue })

    const editProps = columnDef.editProps
    switch (editProps.type) {
      case 'checkbox':
        newValue = editProps.data[e.target.checked ? 'checked' : 'unchecked']
        break
      case 'date':
        newValue = newValue != '' ? dayjs(newValue).format('YYYY-MM-DD HH:mm:ss') : ''
        break
      case 'modal':
        const targetColumn = editProps?.targetColumn
        Object.entries(editProps?.targetColumn).forEach(([target, mapping]) => {
          console.log(row._valuesCache[mapping])
          console.log(row.original[target])

          row._valuesCache[mapping] = newValue.original[target]
        })
        return setValue(newValue.original[column.id])
        break

      default:
        break
    }
    setValue(newValue)

    row._valuesCache[column.id] = newValue
    // if (editProps.type != 'text') setEditingRow(row)
  }

  const handleBlur = (e) => {
    if (table.options.editDisplayMode == 'table') {
      if ('setEditedRows' in props) {
        if (hasRowChanged(row) && row.original['MRT_State'] != '추가') {
          row._valuesCache['MRT_State'] = '수정'
          props.setEditedRows((editedRows) => ({
            ...editedRows,
            [row.id]: row,
          }))
        } else {
          row._valuesCache['MRT_State'] = ''
          props.setEditedRows((editedRows) => {
            const { [row.id]: removed, ...remainRows } = editedRows
            return remainRows
          })
        }
      }
    }
  }
  return { value, handleOnChange, handleBlur }
}
