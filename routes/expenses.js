const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../authMiddleware');

// Добавить расход
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, note, category_id, date } = req.body;

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount,
        note: note || null,
        category_id: category_id || null,
        date: date || new Date().toISOString()
      })
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Add expense error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получить все расходы пользователя
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        categories!inner(name)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Обновить расход
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { amount, note, category_id, date } = req.body;

    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount,
        note: note || null,
        category_id: category_id || null,
        date: date || new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Расход не найден' });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Удалить расход
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Расход не найден' });
    }

    res.json({ message: 'Расход удалён', deleted: data[0] });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получить сводку расходов
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date, from, to } = req.query;

    let query = supabase
      .from('expenses')
      .select('amount, date, categories!inner(name, priority)', { count: 'exact' })
      .eq('user_id', userId);

    if (date) {
      query = query.eq('date', date);
    } else if (from && to) {
      query = query.gte('date', from).lte('date', to);
    } else {
      // Текущий месяц
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      query = query.gte('date', firstDay).lte('date', lastDay);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const total = data.reduce((sum, expense) => sum + expense.amount, 0);

    res.json({
      total,
      count,
      expenses: data
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Сводка за сегодня
router.get('/summary/today', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .eq('date', today);

    if (error) throw error;

    const total = data.reduce((sum, expense) => sum + expense.amount, 0);

    res.json({ date: today, total });
  } catch (err) {
    console.error('Today summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Сводка за месяц
router.get('/summary/month', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', firstDay)
      .lte('date', lastDay);

    if (error) throw error;

    const total = data.reduce((sum, expense) => sum + expense.amount, 0);

    res.json({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      total
    });
  } catch (err) {
    console.error('Month summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;