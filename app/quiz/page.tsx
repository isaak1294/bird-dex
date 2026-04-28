export const dynamic = 'force-dynamic';

import { getDistinctBirdCategories } from '@/lib/db';
import QuizClient from './QuizClient';

export default async function QuizPage() {
  const categories = await getDistinctBirdCategories();
  return <QuizClient categories={categories} />;
}
