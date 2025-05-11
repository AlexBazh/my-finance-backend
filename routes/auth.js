const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../db');
const nodemailer = require('nodemailer');
const auth = require('../authMiddleware');

// Настройка почтового отправителя
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Регистрация
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Регистрация пользователя через Supabase (новый API v2)
     const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('User not created');

    await new Promise(resolve => setTimeout(resolve, 1000));

    const confirmationToken = crypto.randomBytes(32).toString('hex');

    // Обновляем пользователя в public.users таблице
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: data.user.id,  // Важно: используем тот же ID что и в auth.users
        email: data.user.email,
        email_confirmation_token: confirmationToken,
        email_confirmed: false,
        created_at: new Date(),
      });

    if (dbError) throw dbError;

    const confirmUrl = `http://localhost:3000/auth/confirm-email?token=${confirmationToken}`;

    await transporter.sendMail({
      from: '"Финансы App" <girfido@yandex.ru>',
      to: email,
      subject: 'Подтверждение почты',
      html: ` 
        <h2>Здравствуйте!</h2>
        <p>Спасибо за регистрацию в приложении «MyFinance».</p>
        <p>Для подтверждения почты нажмите на ссылку ниже:</p>
        <a href="${confirmUrl}">Подтвердить почту</a>
        <p>Если вы не регистрировались — просто проигнорируйте это письмо.</p>
      `
    });

    res.status(201).json({ message: 'Письмо для подтверждения отправлено на почту' });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
});


// Логин
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Аутентификация пользователя
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(400).json({ error: error.message });
    }

    // 2. Проверка подтверждения email (если требуется)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email_confirmed')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      return res.status(400).json({ error: 'Ошибка при проверке пользователя' });
    }

    if (!userData.email_confirmed) {
      return res.status(403).json({ error: 'Email не подтверждён' });
    }

    // 3. Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: data.user.id,
        email: data.user.email
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // 4. Возвращаем токен и данные пользователя
    res.json({ 
      token,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Подтверждение почты
router.get('/confirm-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Токен отсутствует' });

  try {
    // Сначала находим пользователя с этим токеном
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, email_confirmed')
      .eq('email_confirmation_token', token)
      .single();

    if (findError || !user) {
      return res.status(400).json({ error: 'Неверный токен' });
    }

    if (user.email_confirmed) {
      return res.status(400).json({ error: 'Email уже подтверждён' });
    }

    // Затем обновляем
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_confirmed: true,
        email_confirmation_token: null
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.send('Email подтверждён!');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка пользователя
router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user.uuid;  // Используем uuid

    const { data, error } = await supabase
      .from('users')
      .select('email, name')
      .eq('uuid', userId)  // Используем uuid
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json({ user: data });
  } catch (err) {
    console.error('Ошибка получения данных пользователя:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
