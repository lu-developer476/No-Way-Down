export type MainMenuSetupStep = 'closed' | 'protagonist' | 'difficulty' | 'players' | 'confirmation'
export interface MainMenuState { ready: boolean; selectedIndex: number; selectedAction: string; setupVisible: boolean; setupStep: MainMenuSetupStep; canContinue: boolean }
export const initialMainMenuState = (canContinue = false): MainMenuState => ({ ready: true, selectedIndex: 0, selectedAction: 'newGame', setupVisible: false, setupStep: 'closed', canContinue })
export const openMainMenuSetup = (state: MainMenuState): MainMenuState => ({ ...state, setupVisible: true, setupStep: 'protagonist' })
export const advanceMainMenuSetup = (state: MainMenuState, setupStep: Exclude<MainMenuSetupStep, 'closed'>): MainMenuState => ({ ...state, setupVisible: true, setupStep })
export const closeMainMenuSetup = (state: MainMenuState): MainMenuState => ({ ...state, setupVisible: false, setupStep: 'closed' })
export const inactiveMainMenuState = (state: MainMenuState): MainMenuState => ({ ...state, ready: false, setupVisible: false, setupStep: 'closed' })
