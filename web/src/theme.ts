import { createTheme } from '@mantine/core';
import type { MantineColorsTuple, ButtonProps } from '@mantine/core';
import { text } from 'stream/consumers';


// Custom color palette for proto-tracker
const protoBlue: MantineColorsTuple = [
  '#e7f5ff',
  '#d0ebff',
  '#a5d8ff',
  '#74c0fc',
  '#339af0',
  '#228be6',
  '#1c7ed6',
  '#1971c2',
  '#1864ab',
  '#0b5394'
];

const protoGrey: MantineColorsTuple = [
  "#f1f5ff",
  "#e6e7ec",
  "#cccdcf",
  "#b1b1b3",
  "#99999b",
  "#8a8b8c",
  "#7e7f82",
  "#6f7174",
  "#62646a",
  "#525660"
]

const protoGreen: MantineColorsTuple = [
  "#e9ffe5",
  "#d5ffce",
  "#aaff9c",
  "#7dff66",
  "#58ff39",
  "#40ff1f",
  "#32ff0f",
  "#24f000",
  "#15ca00",
  "#00ae00"
];

export const theme = createTheme({
  primaryColor: 'proto-grey',
  colors: {
    'proto-blue': protoBlue,
    'proto-green': protoGreen,
    'proto-grey': protoGrey,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '600',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        color: '#7fcf00',
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    },
    Switch: {
      defaultProps: {
        color: '#7fcf00',
        size: 'sm',
      },
    },
    Checkbox: {
      defaultProps: {
        color: '#7fcf00',
        size: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'md',
        centered: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
  breakpoints: {
    xs: '30em',
    sm: '48em',
    md: '64em',
    lg: '74em',
    xl: '90em',
  },
});