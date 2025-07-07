import express from 'express';
import cors from 'cors';
import { createUser } from './createUser';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/create-user', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await createUser(email, password);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('✅ Backend API rodando em http://localhost:3001');
});
