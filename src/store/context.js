import { createContext, useContext } from 'react'

// 데모 저장소(AppStore)와 서버 저장소(ServerStore)가 같은 모양의 값을 넣는다.
// { mode: 'demo' | 'server', ready, error, clearError, state, me, myTeams, ...actions }
export const StoreContext = createContext(null)

export function useStore() {
  return useContext(StoreContext)
}
