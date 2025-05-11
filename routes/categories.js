const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../authMiddleware');

// Получить все категории пользователя
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Проверяем наличие пользовательских категорий
    const { data: userCategories, error: userError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);

    if (userError) throw userError;

    // 2. Если нет категорий - копируем дефолтные
    if (!userCategories || userCategories.length === 0) {
      const { data: defaultCategories, error: defaultError } = await supabase
        .from('categories')
        .select('name, icon, priority')
        .eq('is_default', true);

      if (defaultError) throw defaultError;

      const categoriesToInsert = defaultCategories.map(cat => ({
        ...cat,
        user_id: userId,
        is_default: false
      }));

      const { error: insertError } = await supabase
        .from('categories')
        .insert(categoriesToInsert);

      if (insertError) throw insertError;
    }

    // 3. Получаем все категории пользователя
    const { data: categories, error: finalError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: true })
      .order('id', { ascending: true });

    if (finalError) throw finalError;

    res.json(categories);
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Создать новую категорию
router.post('/', auth, async (req, res) => {
  try {
    const { name, icon, priority } = req.body;
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name,
        icon: icon || null,
        priority: priority || 0,
        is_default: false
      })
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Обновить категорию
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, icon, priority } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({
        name,
        icon,
        priority
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }

    res.json(data[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Удалить категорию
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }

    res.json({ message: 'Категория удалена', deleted: data[0] });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Восстановить все дефолтные категории
router.post('/restore-all', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Получаем дефолтные категории
    const { data: defaultCategories, error: defaultError } = await supabase
      .from('categories')
      .select('name, icon, priority')
      .eq('is_default', true);

    if (defaultError) throw defaultError;

    // 2. Получаем существующие категории пользователя
    const { data: userCategories, error: userError } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId);

    if (userError) throw userError;

    // 3. Фильтруем дефолтные, которых нет у пользователя
    const userCategoryNames = userCategories.map(c => c.name);
    const categoriesToAdd = defaultCategories.filter(
      cat => !userCategoryNames.includes(cat.name)
    );

    if (categoriesToAdd.length === 0) {
      return res.json({ message: 'Все дефолтные категории уже есть у пользователя' });
    }

    // 4. Добавляем недостающие
    const categoriesWithUserId = categoriesToAdd.map(cat => ({
      ...cat,
      user_id: userId,
      is_default: false
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('categories')
      .insert(categoriesWithUserId)
      .select();

    if (insertError) throw insertError;

    res.json({
      message: `Добавлено ${inserted.length} категорий`,
      categories: inserted
    });
  } catch (err) {
    console.error('Restore categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;