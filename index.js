const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const expenseRoutes = require('./routes/expenses');

dotenv.config();
const app = express();

// Разрешаем все домены (или только ваш фронтенд, если хотите ограничить доступ)
app.use(cors({
  origin: '*',  // Указываем фронтенд домен (если хотите разрешить только его)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Указываем методы, которые разрешаем
  allowedHeaders: ['Content-Type', 'Authorization'],  // Разрешаем необходимые заголовки
}));

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/expenses', expenseRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});