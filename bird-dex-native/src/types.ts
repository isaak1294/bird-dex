export type User = {
  id: number;
  username: string;
  region: string;
  created_at: string;
};

export type Photo = {
  id: number;
  bird_id: number;
  url: string;
  caption: string;
  created_at: string;
};

export type Bird = {
  id: number;
  name: string;
  category: string;
  discovered: 0 | 1;
  discovered_at: string | null;
  field_notes: string;
  cover_photo_id: number | null;
  frequency: number | null;
  is_target: 0 | 1;
  updated_at: string;
  photos: Photo[];
};

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type RootTabParamList = {
  BirdDexTab: undefined;
  QuizTab: undefined;
  ProfileTab: undefined;
};

export type BirdDexStackParamList = {
  BirdDexHome: undefined;
  BirdDetail: {
    birdId: number;
    prevBirdId: number | null;
    nextBirdId: number | null;
  };
};
