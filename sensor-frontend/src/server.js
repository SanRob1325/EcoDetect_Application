import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));


app.use(express.json())

app.use('/api', someRoutes);

app.listen(5000, () => console.log('Server is running on port 5000'))
