import { CustomComboboxItem } from '@/components/CustomCombobox'
import useQueryCustom from '@/hooks/useQueryCustom'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { MRT_Cell, MRT_Row, MRT_RowData } from 'mantine-react-table'

// 현재 CELL 값 조회
export const getValue = (cell: MRT_Cell<MRT_RowData>) => {
  let inputValue
  if (cell.row._valuesCache[cell.column.id] != null) {
    inputValue = cell.row._valuesCache[cell.column.id]
  } else if (cell.getValue() != null) {
    inputValue = cell.getValue()
  } else {
    inputValue = cell.row.original[cell.column.id]
  }
  return inputValue
}

// 행 변경 확인
export const hasRowChanged = (row: MRT_Row<MRT_RowData>) => {
  const isChanged = row
    .getAllCells()
    .filter((cell) => {
      const { column } = cell
      const { columnDef } = column
      // enableEditing이 참
      // editProps의 타입이 있음
      // mrt-row로 시작하지 않음
      // MRT_State 이면 안됨
      return (
        columnDef.enableEditing != false &&
        columnDef.editProps.type != null &&
        !column.id.startsWith('mrt-row') &&
        column.id != 'MRT_State'
      )
    })
    .map((cell) => cell.column.id)
    .filter(
      (columnId) =>
        row._valuesCache[columnId] != null && row.original[columnId] != row._valuesCache[columnId],
    )
  console.log({ row })

  console.log({ isChanged })

  return isChanged.length > 0
}

// 커스텀 훅 또는 파라미터가 배열인지 아닌지 체크하는 함수
// TODO: 훅을 파라미터로 받는게 아니라 쿼리키와 파라미터를 파라미터로 받는 걸로 변경 필요!
export const useConditionalQuery = (data: [] | object) => {
  // 기본값 설정
  let isFetching = false
  let isLoading = false
  let isSuccess = false
  let dataResult = []
  let refetch = () => {}
  let queryKey = ''

  // `data`가 배열이 아닐 경우 `useQueryCustom` 호출
  const queryResult = useQueryCustom({
    fetchOptions: data.fetchOptions,
    queryOptions: {
      ...data.options,
      enabled: !Array.isArray(data),
    },
  })
  isFetching = queryResult.isFetching
  isLoading = queryResult.isLoading
  isSuccess = queryResult.isSuccess
  dataResult = queryResult.data
  refetch = queryResult.refetch
  queryKey = queryResult.queryKey

  if (Array.isArray(data)) {
    dataResult = data
    isSuccess = true
    refetch = () => [...data]
  }

  return {
    isFetching,
    isLoading,
    isSuccess,
    data: isSuccess ? (dataResult?.data ?? dataResult) : [],
    refetch,
    queryKey,
  }
}
