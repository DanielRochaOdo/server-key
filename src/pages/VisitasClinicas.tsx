import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  createVisitaClinica,
  deleteVisitaClinica,
  listVisitasClinicas,
  updateVisitaClinica,
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
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
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
    } finally {
      setSaving(false);
    }
  };

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
              />
            </div>

            <div>
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
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
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
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetForm(selectedDate || undefined)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                >
                  Cancelar edicao
                </button>
              )}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitasClinicas;
