import { createContext, useContext } from 'react';

import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  type NumberFormatSettings,
} from './number-format';

export const NumberFormatContext = createContext<NumberFormatSettings>(
  DEFAULT_NUMBER_FORMAT_SETTINGS,
);

export function useActiveNumberFormatSettings() {
  return useContext(NumberFormatContext);
}
