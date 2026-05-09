import { modals } from '@mantine/modals'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import toast from 'react-hot-toast'

const useMutationCustom = (
  endpoint: string,
  options?: { method: string; queryKey?: (string | Record<string, any>)[] },
) => {
  const queryClient = useQueryClient()
  const fetchURL = new URL(endpoint, 'http://localhost:8000')
  const mutation = useMutation({
    mutationFn: async (createData) => {
      return fetch(fetchURL.href, {
        method: options?.method,
        body: JSON.stringify(createData),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(async (res) => {
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.detail?.replaceAll('\\n', '\n'))
        }
        if (json.result != 'ok') {
          throw new Error(json.msg)
        }

        return json
      })
    },
  })
  return mutation
}

export default useMutationCustom
