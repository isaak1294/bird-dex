import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function BirdIcon({ size = 48, discovered }: { size?: number; discovered: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M32 8c-4 0-8 2-10 5-3-1-7 0-9 3-2 2-2 5-1 8-3 1-5 4-5 7 0 4 3 7 7 8v2c0 2 1 4 3 5 1 1 3 1 4 0v4c0 1 1 2 2 2h18c1 0 2-1 2-2v-4c1 1 3 1 4 0 2-1 3-3 3-5v-2c4-1 7-4 7-8 0-3-2-6-5-7 1-3 1-6-1-8-2-3-6-4-9-3-2-3-6-5-10-5z"
        fill={discovered ? '#86c9a4' : '#a8c4d8'}
      />
    </Svg>
  );
}
