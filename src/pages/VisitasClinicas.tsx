<<<<<<< HEAD
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react';
import { usePersistence } from '../contexts/PersistenceContext';
import { useAuth } from '../contexts/AuthContext';
=======
﻿import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
import {
  createVisitaClinica,
  deleteVisitaClinica,
  listVisitasClinicas,
  updateVisitaClinica,
<<<<<<< HEAD
} from '../services/visitasClinicas';

type VisitStatus = 'concluido' | 'pendente' | 'atrasado';

type Visit = {
  id: string;
  date: string;
  servico: string;
  clinica: string;
  pessoa1: string;
  pessoa2: string;
  pessoa3: string;
  status: VisitStatus;
  createdAt: string;
};

type VisitForm = {
  date: string;
  servico: string;
  clinica: string;
  pessoa1: string;
  pessoa2: string;
  pessoa3: string;
  status: VisitStatus;
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const CLINICAS = ['Parangaba', 'Bezerra', 'Aguanambi'];
const PESSOAS = ['Flash', 'Vinicius', 'Daniel', 'Ryan', 'Cezar'];
const STATUS_OPTIONS: Array<{ value: VisitStatus; label: string; color: string }> = [
  {
    value: 'concluido',
    label: 'Concluido',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  },
  {
    value: 'pendente',
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  },
  {
    value: 'atrasado',
    label: 'Atrasado',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const buildMonthGrid = (year: number, monthIndex: number) => {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const weeks: Array<Array<Date | null>> = [];
  let dayCounter = 1;

  for (let week = 0; week < 6; week += 1) {
    const weekDays: Array<Date | null> = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      if (week === 0 && weekday < startWeekday) {
        weekDays.push(null);
        continue;
      }
      if (dayCounter > daysInMonth) {
        weekDays.push(null);
        continue;
      }
      weekDays.push(new Date(year, monthIndex, dayCounter));
      dayCounter += 1;
    }
    if (weekDays.every((day) => day === null)) break;
    weeks.push(weekDays);
  }

  return weeks;
};

const buildDefaultForm = (dateKey: string): VisitForm => ({
  date: dateKey,
  servico: '',
  clinica: '',
  pessoa1: '',
  pessoa2: '',
  pessoa3: '',
  status: 'pendente',
});

const buildMonthRange = (year: number, monthIndex: number) => {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
};

const isValidDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseDateKey(value);
  return toDateKey(parsed) === value;
};

const VisitasClinicas: React.FC = () => {
  const { getState, setState } = usePersistence();
  const { user } = useAuth();
  const todayKey = toDateKey(new Date());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const savedMonth = getState('visitasClinicas_month');
    if (savedMonth) {
      const [year, month] = String(savedMonth).split('-').map((part) => Number(part));
      if (year && month) return new Date(year, month - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    return getState('visitasClinicas_selectedDate') || todayKey;
  });

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);

  const [formData, setFormData] = useState<VisitForm>(() => buildDefaultForm(selectedDateKey));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setState('visitasClinicas_selectedDate', selectedDateKey);
  }, [selectedDateKey, setState]);

  useEffect(() => {
    setState(
      'visitasClinicas_month',
      `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    );
  }, [currentMonth, setState]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, date: selectedDateKey }));
  }, [selectedDateKey]);

  const loadVisits = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const { startDate, endDate } = buildMonthRange(year, monthIndex);

    setLoading(true);
    setLoadError('');

    try {
      const rows = await listVisitasClinicas(startDate, endDate);
      const mapped = rows.map((row) => ({
        id: row.id,
        date: row.data,
        servico: row.servico || '',
        clinica: row.clinica || '',
        pessoa1: row.pessoa_1 || '',
        pessoa2: row.pessoa_2 || '',
        pessoa3: row.pessoa_3 || '',
        status: row.status as VisitStatus,
        createdAt: row.created_at || new Date().toISOString(),
      }));
      setVisits(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar visitas.';
      setLoadError(message);
=======
  type VisitaClinica,
} from '../services/visitasClinicas';

const CLINICAS = ['Parangaba', 'Bezerra', 'Aguanambi'];
const PESSOAS = ['Flash', 'Vinicius', 'Daniel', 'Ryan', 'Cezar'];
const STATUS_OPTIONS = ['concluido', 'pendente', 'atrasado'] as const;

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const statusStyles: Record<string, string> = {
  concluido: 'bg-green-100 text-green-700',
  pendente: 'bg-amber-100 text-amber-700',
  atrasado: 'bg-red-100 text-red-700',
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map((item) => Number(item));
  return new Date(year, (month || 1) - 1, day || 1);
};

const buildCalendarDays = (monthDate: Date) => {
  const firstDay = startOfMonth(monthDate);
  const lastDay = endOfMonth(monthDate);
  const leadingBlanks = firstDay.getDay();
  const days: (Date | null)[] = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const formatDisplayDate = (date: Date) => date.toLocaleDateString('pt-BR');

const normalizePerson = (value: string) => (value.trim() ? value.trim() : null);

const sortVisitas = (items: VisitaClinica[]) =>
  [...items].sort((a, b) => {
    const dateCompare = a.data.localeCompare(b.data);
    if (dateCompare !== 0) return dateCompare;
    return a.created_at.localeCompare(b.created_at);
  });

const VisitasClinicas: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [visitas, setVisitas] = useState<VisitaClinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    servico: '',
    clinica: '',
    pessoa1: '',
    pessoa2: '',
    pessoa3: '',
    status: 'pendente',
  });

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : '';
  const todayKey = toDateKey(new Date());

  const visitasPorDia = useMemo(() => {
    const map = new Map<string, VisitaClinica[]>();
    visitas.forEach((visita) => {
      const key = visita.data;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(visita);
    });
    return map;
  }, [visitas]);

  const selectedVisitas = selectedDateKey ? visitasPorDia.get(selectedDateKey) || [] : [];

  const loadVisitas = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const startKey = toDateKey(startOfMonth(currentMonth));
      const endKey = toDateKey(endOfMonth(currentMonth));
      const data = await listVisitasClinicas(startKey, endKey);
      setVisitas(sortVisitas(data));
    } catch (err) {
      console.error('Erro ao carregar visitas:', err);
      setError('Erro ao carregar visitas.');
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
<<<<<<< HEAD
    loadVisits();
  }, [loadVisits]);

  const visitsByDate = useMemo(() => {
    return visits.reduce<Record<string, Visit[]>>((acc, visit) => {
      if (!acc[visit.date]) acc[visit.date] = [];
      acc[visit.date].push(visit);
      return acc;
    }, {});
  }, [visits]);

  const selectedVisits = visitsByDate[selectedDateKey] || [];

  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();
  const monthLabel = `${MONTHS[currentMonthIndex]} ${currentYear}`;
  const monthGrid = useMemo(
    () => buildMonthGrid(currentYear, currentMonthIndex),
    [currentYear, currentMonthIndex]
  );

  const handlePrevMonth = () => {
    const next = new Date(currentYear, currentMonthIndex - 1, 1);
    setCurrentMonth(next);
    if (parseDateKey(selectedDateKey).getMonth() !== next.getMonth() || parseDateKey(selectedDateKey).getFullYear() !== next.getFullYear()) {
      setSelectedDateKey(toDateKey(next));
    }
  };

  const handleNextMonth = () => {
    const next = new Date(currentYear, currentMonthIndex + 1, 1);
    setCurrentMonth(next);
    if (parseDateKey(selectedDateKey).getMonth() !== next.getMonth() || parseDateKey(selectedDateKey).getFullYear() !== next.getFullYear()) {
      setSelectedDateKey(toDateKey(next));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(toDateKey(today));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDateKey(toDateKey(date));
    setFormError('');
    setEditingVisitId(null);
    setFormData(buildDefaultForm(toDateKey(date)));
  };

  const handleFormChange = (field: keyof VisitForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const handleDateChange = (value: string) => {
    setFormData((prev) => ({ ...prev, date: value }));
    setFormError('');

    if (!isValidDateKey(value)) return;
    setSelectedDateKey(value);
    const parsed = parseDateKey(value);
    setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const servico = formData.servico.trim();
    const clinica = formData.clinica.trim();
    const pessoa1 = formData.pessoa1.trim();
    const status = formData.status;

    const targetDate = formData.date.trim();

    if (!targetDate) {
      setFormError('Selecione uma data no calendario.');
      return;
    }
    if (!isValidDateKey(targetDate)) {
      setFormError('Data invalida.');
      return;
    }
    if (!servico) {
      setFormError('Informe o servico.');
      return;
    }
    if (!clinica) {
      setFormError('Selecione a clinica.');
      return;
    }
    if (!pessoa1) {
      setFormError('Selecione a Pessoa 1.');
      return;
    }
    if (!status) {
      setFormError('Selecione o status.');
      return;
    }

    if (!user?.id) {
      setFormError('Usuario nao autenticado.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      data: targetDate,
      servico,
      clinica,
      pessoa_1: pessoa1,
      pessoa_2: formData.pessoa2.trim() || null,
      pessoa_3: formData.pessoa3.trim() || null,
      status,
    };

    try {
      if (editingVisitId) {
        const updated = await updateVisitaClinica(editingVisitId, payload);
        setVisits((prev) =>
          prev.map((visit) =>
            visit.id === editingVisitId
              ? {
                  id: updated.id,
                  date: updated.data,
                  servico: updated.servico || '',
                  clinica: updated.clinica || '',
                  pessoa1: updated.pessoa_1 || '',
                  pessoa2: updated.pessoa_2 || '',
                  pessoa3: updated.pessoa_3 || '',
                  status: updated.status as VisitStatus,
                  createdAt: updated.created_at || visit.createdAt,
                }
              : visit
          )
        );
        setEditingVisitId(null);
      } else {
        const created = await createVisitaClinica({
          ...payload,
          user_id: user.id,
        });
        setVisits((prev) => [
          {
            id: created.id,
            date: created.data,
            servico: created.servico || '',
            clinica: created.clinica || '',
            pessoa1: created.pessoa_1 || '',
            pessoa2: created.pessoa_2 || '',
            pessoa3: created.pessoa_3 || '',
            status: created.status as VisitStatus,
            createdAt: created.created_at || new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setFormData(buildDefaultForm(selectedDateKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar visita.';
      setFormError(message);
=======
    loadVisitas();
  }, [loadVisitas]);

  useEffect(() => {
    if (!selectedDate) return;
    if (selectedDate.getMonth() !== currentMonth.getMonth() || selectedDate.getFullYear() !== currentMonth.getFullYear()) {
      setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
      setEditingId(null);
      setFormData({
        servico: '',
        clinica: '',
        pessoa1: '',
        pessoa2: '',
        pessoa3: '',
        status: 'pendente',
      });
    }
  }, [currentMonth, selectedDate]);

  const resetForm = (date?: Date) => {
    setEditingId(null);
    setError('');
    setFormData({
      servico: '',
      clinica: '',
      pessoa1: '',
      pessoa2: '',
      pessoa3: '',
      status: 'pendente',
    });
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1;
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(nextMonth);
    resetForm(nextMonth);
  };

  const handleSelectDate = (date: Date) => {
    resetForm(date);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (visita: VisitaClinica) => {
    const date = parseDateKey(visita.data);
    setCurrentMonth(startOfMonth(date));
    setSelectedDate(date);
    setEditingId(visita.id);
    setFormData({
      servico: visita.servico || '',
      clinica: visita.clinica || '',
      pessoa1: visita.pessoa1 || '',
      pessoa2: visita.pessoa2 || '',
      pessoa3: visita.pessoa3 || '',
      status: visita.status || 'pendente',
    });
  };

  const handleDelete = async (visita: VisitaClinica) => {
    if (!confirm('Deseja excluir esta visita?')) return;

    try {
      await deleteVisitaClinica(visita.id);
      setVisitas((prev) => prev.filter((item) => item.id !== visita.id));
      if (editingId === visita.id) {
        resetForm(selectedDate || undefined);
      }
    } catch (err) {
      console.error('Erro ao excluir visita:', err);
      setError('Erro ao excluir visita.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!selectedDate) {
      setError('Selecione um dia no calendario.');
      return;
    }

    if (!formData.servico.trim()) {
      setError('Informe o servico.');
      return;
    }

    if (!formData.clinica) {
      setError('Selecione a clinica.');
      return;
    }

    if (!formData.status) {
      setError('Selecione o status.');
      return;
    }

    const payload = {
      data: selectedDateKey,
      servico: formData.servico.trim(),
      clinica: formData.clinica,
      pessoa1: normalizePerson(formData.pessoa1),
      pessoa2: normalizePerson(formData.pessoa2),
      pessoa3: normalizePerson(formData.pessoa3),
      status: formData.status as 'concluido' | 'pendente' | 'atrasado',
    };

    try {
      setSaving(true);
      if (editingId) {
        const updated = await updateVisitaClinica(editingId, payload);
        setVisitas((prev) => sortVisitas(prev.map((item) => (item.id === editingId ? updated : item))));
      } else {
        const created = await createVisitaClinica(payload);
        setVisitas((prev) => sortVisitas([...prev, created]));
      }
      resetForm(selectedDate);
    } catch (err) {
      console.error('Erro ao salvar visita:', err);
      setError('Erro ao salvar visita.');
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
    } finally {
      setSaving(false);
    }
  };

<<<<<<< HEAD
  const handleDeleteVisit = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta visita?')) return;
    try {
      await deleteVisitaClinica(id);
      setVisits((prev) => prev.filter((visit) => visit.id !== id));
      if (editingVisitId === id) {
        setEditingVisitId(null);
        setFormData(buildDefaultForm(selectedDateKey));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir visita.';
      setFormError(message);
    }
  };

  const handleEditVisit = (visit: Visit) => {
    setEditingVisitId(visit.id);
    setSelectedDateKey(visit.date);
    setFormData({
      date: visit.date,
      servico: visit.servico,
      clinica: visit.clinica,
      pessoa1: visit.pessoa1,
      pessoa2: visit.pessoa2,
      pessoa3: visit.pessoa3,
      status: visit.status,
    });
    setFormError('');
  };

  const handleCancelEdit = () => {
    setEditingVisitId(null);
    setFormData(buildDefaultForm(selectedDateKey));
    setFormError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900 dark:text-primary-100">
            Visitas as Clinicas
          </h1>
          <p className="mt-1 text-sm text-primary-600 dark:text-neutral-300">
            Controle mensal de visitas com calendario e detalhes por dia.
          </p>
        </div>
        <button
          onClick={handleToday}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Calendar className="h-4 w-4" />
          Ir para hoje
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 sm:p-6 dark:bg-neutral-900 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Proximo mes"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center font-semibold uppercase">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthGrid.map((week, weekIndex) => (
              <React.Fragment key={`week-${weekIndex}`}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square" />;
                  }
                  const dayKey = toDateKey(day);
                  const isToday = dayKey === todayKey;
                  const isSelected = dayKey === selectedDateKey;
                  const visitCount = visitsByDate[dayKey]?.length || 0;

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => handleDateClick(day)}
                      className={`relative flex items-center justify-center aspect-square rounded-lg border text-sm font-semibold transition-colors
                        ${isSelected
                          ? 'bg-primary-600 text-white border-primary-600 dark:bg-primary-500 dark:border-primary-400'
                          : isToday
                            ? 'border-primary-500 text-primary-700 dark:border-primary-400 dark:text-primary-200'
                            : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'}`}
                    >
                      {day.getDate()}
                      {visitCount > 0 && (
                        <span
                          className={`absolute top-1 right-1 text-[10px] rounded-full px-1.5 py-0.5 ${isSelected ? 'bg-white text-primary-700 dark:bg-neutral-900 dark:text-primary-200' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200'}`}
                        >
                          {visitCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-4 sm:p-6 dark:bg-neutral-900 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Detalhes da visita
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Data selecionada: {selectedDateKey}
              </p>
            </div>
          </div>

          {loadError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200">
              {loadError}
            </div>
          )}

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                Data
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => handleDateChange(event.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                Servico
              </label>
              <input
                type="text"
                value={formData.servico}
                onChange={(event) => handleFormChange('servico', event.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder-neutral-500"
                placeholder="Digite o servico"
=======
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthLabel = useMemo(() => formatMonthLabel(currentMonth), [currentMonth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Visitas as Clinicas</h1>
          <p className="text-sm text-primary-600">Agenda de visitas por clinica e equipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleMonthChange('prev')}
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-neutral-200 shadow-sm">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-semibold text-neutral-700 capitalize">{monthLabel}</span>
          </div>
          <button
            onClick={() => handleMonthChange('next')}
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50"
            aria-label="Proximo mes"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-neutral-500 uppercase">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="text-center">{day}</div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="h-20 sm:h-24" />;
              }

              const dayKey = toDateKey(day);
              const dayVisits = visitasPorDia.get(dayKey) || [];
              const isSelected = dayKey === selectedDateKey;
              const isToday = dayKey === todayKey;

              return (
                <button
                  key={dayKey}
                  onClick={() => handleSelectDate(day)}
                  className={`
                    h-20 sm:h-24 rounded-xl border text-left p-2 transition-colors
                    ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}
                    ${isToday ? 'ring-1 ring-primary-400' : ''}
                  `}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-800">{day.getDate()}</span>
                    {dayVisits.length > 0 && (
                      <span className="text-[11px] font-semibold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                        {dayVisits.length} visita{dayVisits.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {dayVisits.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dayVisits.slice(0, 3).map((visita) => (
                        <span
                          key={visita.id}
                          className={`h-2 w-2 rounded-full ${
                            visita.status === 'concluido'
                              ? 'bg-green-500'
                              : visita.status === 'atrasado'
                                ? 'bg-red-500'
                                : 'bg-amber-500'
                          }`}
                        />
                      ))}
                      {dayVisits.length > 3 && (
                        <span className="text-[10px] text-neutral-400">+{dayVisits.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="mt-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Detalhes da visita</h2>
              <p className="text-sm text-neutral-500">
                {selectedDate ? `Dia ${formatDisplayDate(selectedDate)}` : 'Selecione um dia no calendario.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetForm(selectedDate || undefined)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <Plus className="h-4 w-4" />
              Novo
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Data</label>
              <input
                type="text"
                value={selectedDate ? formatDisplayDate(selectedDate) : ''}
                disabled
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-500"
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
              />
            </div>

            <div>
<<<<<<< HEAD
              <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                Clinica
              </label>
              <select
                value={formData.clinica}
                onChange={(event) => handleFormChange('clinica', event.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                <option value="">Selecione</option>
                {CLINICAS.map((clinica) => (
                  <option key={clinica} value={clinica}>
                    {clinica}
                  </option>
=======
              <label className="block text-sm font-medium text-neutral-700 mb-1">Servico</label>
              <input
                type="text"
                name="servico"
                value={formData.servico}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Clinica</label>
              <select
                name="clinica"
                value={formData.clinica}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecione</option>
                {CLINICAS.map((clinica) => (
                  <option key={clinica} value={clinica}>{clinica}</option>
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
<<<<<<< HEAD
                <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                  Pessoa 1
                </label>
                <select
                  value={formData.pessoa1}
                  onChange={(event) => handleFormChange('pessoa1', event.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>
                      {pessoa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                  Pessoa 2
                </label>
                <select
                  value={formData.pessoa2}
                  onChange={(event) => handleFormChange('pessoa2', event.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>
                      {pessoa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                  Pessoa 3
                </label>
                <select
                  value={formData.pessoa3}
                  onChange={(event) => handleFormChange('pessoa3', event.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>
                      {pessoa}
                    </option>
=======
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pessoa 1</label>
                <select
                  name="pessoa1"
                  value={formData.pessoa1}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>{pessoa}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pessoa 2</label>
                <select
                  name="pessoa2"
                  value={formData.pessoa2}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>{pessoa}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Pessoa 3</label>
                <select
                  name="pessoa3"
                  value={formData.pessoa3}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione</option>
                  {PESSOAS.map((pessoa) => (
                    <option key={pessoa} value={pessoa}>{pessoa}</option>
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
                  ))}
                </select>
              </div>
            </div>

            <div>
<<<<<<< HEAD
              <label className="block text-sm font-medium text-neutral-700 mb-1 dark:text-neutral-300">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(event) => handleFormChange('status', event.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
=======
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
                ))}
              </select>
            </div>

<<<<<<< HEAD
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-900/40 dark:text-red-200">
                {formError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-400"
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : editingVisitId ? 'Atualizar visita' : 'Salvar visita'}
              </button>
              {editingVisitId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
=======
            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetForm(selectedDate || undefined)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
                >
                  Cancelar edicao
                </button>
              )}
<<<<<<< HEAD
            </div>
          </form>

          <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Visitas do dia ({selectedVisits.length})
            </h3>
            <div className="mt-3 space-y-3">
              {selectedVisits.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Nenhuma visita cadastrada para este dia.
                </p>
              )}
              {selectedVisits.map((visit) => {
                const statusInfo = STATUS_OPTIONS.find((item) => item.value === visit.status);
                const people = [visit.pessoa1, visit.pessoa2, visit.pessoa3].filter(Boolean).join(', ');
                return (
                  <div
                    key={visit.id}
                    className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {visit.servico}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Clinica: {visit.clinica}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Pessoas: {people || '-'}
                        </p>
                      </div>
                      {statusInfo && (
                        <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditVisit(visit)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVisit(visit.id)}
                        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
=======
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar edicao' : 'Salvar visita'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-neutral-700 mb-2">Visitas do dia</h3>
            {selectedVisitas.length === 0 ? (
              <div className="text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-lg px-3 py-4 text-center">
                Nenhuma visita cadastrada neste dia.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedVisitas.map((visita) => (
                  <div
                    key={visita.id}
                    className="border border-neutral-200 rounded-lg p-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-neutral-900">{visita.servico}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[visita.status] || 'bg-neutral-100 text-neutral-600'}`}>
                          {visita.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-1">Clinica: {visita.clinica}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Pessoas: {[visita.pessoa1, visita.pessoa2, visita.pessoa3].filter(Boolean).join(', ') || 'Nao informado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(visita)}
                        className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        title="Editar"
                        type="button"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(visita)}
                        className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        title="Excluir"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
>>>>>>> 5367ea213892bbfb5653047b0660e7941be3bf27
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitasClinicas;
