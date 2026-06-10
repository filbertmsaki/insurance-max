import axios, { type AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { API_BASE_URL } from '@/config'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token!)
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
          }
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
        )
        // Backend returns camelCase: { accessToken, refreshToken }
        const { accessToken, refreshToken: newRefresh } = response.data
        useAuthStore.getState().setTokens(accessToken, newRefresh)
        processQueue(null, accessToken)
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred'

    if (error.response?.status !== 401) {
      toast.error(Array.isArray(message) ? message[0] : message)
    }

    return Promise.reject(error)
  },
)
