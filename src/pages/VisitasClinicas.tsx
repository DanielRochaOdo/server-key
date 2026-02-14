import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react';
import { usePersistence } from '../contexts/PersistenceContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createVisitaClinica,
  deleteVisitaClinica,
  listVisitasClinicas,
  updateVisitaClinica,
} from '../services/visitasClinicas';
import ModuleHeader from '../components/ModuleHeader';

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
const PESSOAS = ['Vinicius', 'Daniel', 'Ryan', 'Cezar'];
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
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
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
    if (
      parseDateKey(selectedDateKey).getMonth() !== next.getMonth() ||
      parseDateKey(selectedDateKey).getFullYear() !== next.getFullYear()
    ) {
      setSelectedDateKey(toDateKey(next));
    }
  };

  const handleNextMonth = () => {
    const next = new Date(currentYear, currentMonthIndex + 1, 1);
    setCurrentMonth(next);
    if (
      parseDateKey(selectedDateKey).getMonth() !== next.getMonth() ||
      parseDateKey(selectedDateKey).getFullYear() !== next.getFullYear()
    ) {
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
    } finally {
      setSaving(false);
    }
  };

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
      <ModuleHeader
        sectionLabel="Financeiro"
        title="Visitas as Clinicas"
        subtitle="Controle mensal de visitas com calendario e detalhes por dia."
        actions={(
          <button
            onClick={handleToday}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-button bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-button transition-colors hover:bg-button-50 sm:w-auto"
          >
            <Calendar className="h-4 w-4" />
            Ir para hoje
          </button>
        )}
      />

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
              />
            </div>

            <div>
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
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
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
                  ))}
                </select>
              </div>
            </div>

            <div>
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
                ))}
              </select>
            </div>

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
                >
                  Cancelar edicao
                </button>
              )}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitasClinicas;
