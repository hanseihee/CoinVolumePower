import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { markets } = req.query;
  if (!markets) {
    res.status(400).json({ error: 'markets query required' });
    return;
  }
  try {
    const url = `https://api.upbit.com/v1/ticker?markets=${markets}`;
    const upbitRes = await fetch(url);
    if (!upbitRes.ok) {
      res.status(upbitRes.status).json({ error: 'Upbit API error' });
      return;
    }
    const data = await upbitRes.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
} 