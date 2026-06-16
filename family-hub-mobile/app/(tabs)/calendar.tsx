import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Plus, Trash2, X } from 'lucide-react-native';
import { api } from '../../lib/api';

LocaleConfig.locales.vi = {
  monthNames: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
  monthNamesShort: ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'],
  dayNames: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'],
  dayNamesShort: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  today: 'Hôm nay',
};
LocaleConfig.defaultLocale = 'vi';

type InnerTab = 'calendar' | 'lists' | 'share' | 'action';
type EventSource = 'manual' | 'generated-birthday' | 'fixed-holiday';

interface EventItem {
  id: string;
  title: string;
  startDate: string;
  startTime: string;
  allDay: boolean;
  calendarId: string;
  eventType: string;
  type: string;
  source: EventSource;
  readonly: boolean;
  color?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  note?: string;
  reminderMinutes?: number;
  repeatRule?: string;
  url?: string;
  todoText?: string;
  fileText?: string;
  visibility?: string;
  allowedMemberIds?: string[];
  relatedMemberIds?: string[];
  memberIds?: string[];
}

interface MemberItem {
  id: string;
  name: string;
  birthday?: string;
  birthDate?: string;
  dateOfBirth?: string;
  dob?: string;
  avatar?: string;
  avatarUrl?: string;
  avatar_url?: string;
  color?: string;
}

const EVENT_TYPES = [
  { key: 'Công việc', label: 'Công việc', color: '#10b981' },
  { key: 'Học tập', label: 'Học tập', color: '#f97316' },
  { key: 'Gia đình', label: 'Gia đình', color: '#3b82f6' },
  { key: 'Cá nhân', label: 'Cá nhân', color: '#8b5cf6' },
  { key: 'Sinh nhật', label: 'Sinh nhật', color: '#f59e0b' },
  { key: 'Ngày lễ', label: 'Ngày lễ', color: '#ef4444' },
  { key: 'Nhắc nhở', label: 'Nhắc nhở', color: '#ec4899' },
  { key: 'Khác', label: 'Khác', color: '#64748b' },
];

const EVENT_FILTERS = [{ key: 'all', label: 'Tất cả', color: '#4f46e5' }, ...EVENT_TYPES];

const TAB_ITEMS: { key: InnerTab; label: string }[] = [
  { key: 'calendar', label: 'Lịch' },
  { key: 'lists', label: 'Danh sách' },
  { key: 'share', label: 'Chia sẻ' },
  { key: 'action', label: 'Hành động' },
];

const VIETNAM_HOLIDAYS = [
  { month: 1, day: 1, title: 'Tết Dương lịch' },
  { month: 4, day: 30, title: 'Giải phóng miền Nam' },
  { month: 5, day: 1, title: 'Quốc tế Lao động' },
  { month: 9, day: 2, title: 'Quốc khánh' },
];

const CALENDAR_OPTIONS = ['Cá nhân', 'Gia đình', 'Công việc', 'Học tập', 'Khác'];
const REPEAT_OPTIONS = [
  { label: 'Không', value: 'none' },
  { label: 'Hằng ngày', value: 'daily' },
  { label: 'Hằng tuần', value: 'weekly' },
  { label: 'Hằng tháng', value: 'monthly' },
  { label: 'Hằng năm', value: 'yearly' },
];
const REMINDER_OPTIONS = [
  { label: 'Không', value: 0 },
  { label: '5 phút', value: 5 },
  { label: '15 phút', value: 15 },
  { label: '30 phút', value: 30 },
  { label: '1 giờ', value: 60 },
  { label: '1 ngày', value: 1440 },
];
const VISIBILITY_OPTIONS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Chỉ mình tôi', value: 'private' },
  { label: 'Tùy chọn', value: 'custom' },
];

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function makeId() {
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeDate(value: any) {
  return String(value || '').slice(0, 10) || todayLocal();
}

function normalizeTime(value: any) {
  return String(value || '').slice(0, 5);
}

function normalizeEventType(event: any) {
  const raw = String(event.eventType || event.type || event.category || event.label || 'Khác').trim();
  const text = raw.toLowerCase();
  const title = String(event.title || '').toLowerCase();
  if (text.includes('work') || text.includes('công') || text.includes('cong') || title.includes('công việc')) return 'Công việc';
  if (text.includes('study') || text.includes('học') || text.includes('hoc') || title.includes('học')) return 'Học tập';
  if (text.includes('family') || text.includes('gia đình') || title.includes('gia đình')) return 'Gia đình';
  if (text.includes('personal') || text.includes('cá nhân') || text.includes('ca nhan') || title.includes('cá nhân')) return 'Cá nhân';
  if (text.includes('birthday') || text.includes('sinh') || title.includes('sinh nhật')) return 'Sinh nhật';
  if (text.includes('holiday') || text.includes('lễ') || text.includes('le') || title.includes('ngày lễ')) return 'Ngày lễ';
  if (text.includes('reminder') || text.includes('nhắc') || text.includes('nhac')) return 'Nhắc nhở';
  return 'Khác';
}

function eventColor(type: string) {
  return EVENT_FILTERS.find(item => item.key === type)?.color || '#64748b';
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function dateParts(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function eventMemberIds(event: EventItem) {
  return [
    ...(event.memberIds || []),
    ...(event.allowedMemberIds || []),
    ...(event.relatedMemberIds || []),
  ].map(String);
}

function memberBirthday(member: MemberItem) {
  return normalizeDate(member.birthday || member.birthDate || member.dateOfBirth || member.dob);
}

function memberNamesForEvent(event: EventItem, members: MemberItem[]) {
  const ids = new Set(eventMemberIds(event));
  return members.filter(member => ids.has(member.id)).map(member => member.name).join(', ');
}

function splitNoteExtras(noteValue: any) {
  const lines = String(noteValue || '').split('\n');
  const noteLines: string[] = [];
  let url = '';
  let todoText = '';
  let fileText = '';
  for (const line of lines) {
    if (line.startsWith('URL: ')) url = line.slice(5);
    else if (line.startsWith('To-do: ')) todoText = line.slice(7);
    else if (line.startsWith('Tệp: ')) fileText = line.slice(5);
    else noteLines.push(line);
  }
  return { note: noteLines.join('\n').trim(), url, todoText, fileText };
}

export default function CalendarScreen() {
  const initialDate = useMemo(() => todayLocal(), []);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleYear, setVisibleYear] = useState(() => dateParts(initialDate).year);
  const [visibleMonth, setVisibleMonth] = useState(() => dateParts(initialDate).month);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InnerTab>('calendar');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedListType, setSelectedListType] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [formTab, setFormTab] = useState<'event' | 'note'>('event');
  const [choiceSheet, setChoiceSheet] = useState<null | 'calendar' | 'repeat' | 'reminder' | 'visibility' | 'label' | 'members'>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCalendar, setFormCalendar] = useState('Gia đình');
  const [formStartDate, setFormStartDate] = useState(selectedDate);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndDate, setFormEndDate] = useState(selectedDate);
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formRepeat, setFormRepeat] = useState('none');
  const [formReminder, setFormReminder] = useState(0);
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [formVisibility, setFormVisibility] = useState('all');
  const [formEventType, setFormEventType] = useState('Gia đình');
  const [formLocation, setFormLocation] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formTodoText, setFormTodoText] = useState('');
  const [formFileText, setFormFileText] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const normalizeEvent = useCallback((event: any): EventItem => {
    const eventType = normalizeEventType(event);
    const extras = splitNoteExtras(event.note || '');
    return {
      id: String(event.id || makeId()),
      title: String(event.title || 'Sự kiện'),
      startDate: normalizeDate(event.startDate || event.start_date || event.date || event.eventDate),
      startTime: normalizeTime(event.startTime || event.start_time || event.time),
      allDay: Boolean(event.allDay ?? event.all_day ?? event.is_all_day),
      calendarId: String(event.calendarId || event.calendar_id || 'default'),
      eventType,
      type: eventType,
      source: 'manual',
      readonly: false,
      color: event.color || event.labelColor || event.label_color || eventColor(eventType),
      endDate: normalizeDate(event.endDate || event.end_date || event.startDate || event.start_date || event.date || event.eventDate),
      endTime: normalizeTime(event.endTime || event.end_time),
      location: String(event.location || ''),
      note: extras.note,
      reminderMinutes: Number(event.reminderMinutes ?? event.reminder_minutes ?? 0),
      repeatRule: String(event.repeatRule || event.repeat_rule || 'none'),
      url: String(event.url || extras.url || ''),
      todoText: String(event.todoText || event.todo_text || extras.todoText || ''),
      fileText: String(event.fileText || event.file_text || extras.fileText || ''),
      visibility: String(event.visibility || 'all'),
      allowedMemberIds: Array.isArray(event.allowedMemberIds) ? event.allowedMemberIds.map(String) : [],
      relatedMemberIds: Array.isArray(event.relatedMemberIds) ? event.relatedMemberIds.map(String) : [],
      memberIds: Array.isArray(event.memberIds) ? event.memberIds.map(String) : [],
    };
  }, []);

  const fetchEvents = useCallback(async (dateObj: Date) => {
    try {
      setLoading(true);
      setError(null);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();
      const json = await api.get(`/api/events?month=${month}&year=${year}`);
      const list = Array.isArray(json.data) ? json.data : [];
      setApiEvents(list.map(normalizeEvent));
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [normalizeEvent]);

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const json = await api.get('/api/members');
      const list = Array.isArray(json.data) ? json.data : [];
      setMembers(list.map((member: any) => ({
        id: String(member.id),
        name: String(member.name || member.displayName || 'Thành viên'),
        birthday: member.birthday,
        birthDate: member.birthDate,
        dateOfBirth: member.dateOfBirth,
        dob: member.dob,
        avatar: member.avatar,
        avatarUrl: member.avatarUrl,
        avatar_url: member.avatar_url,
        color: member.color || '#4f46e5',
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(new Date(`${initialDate}T00:00:00`));
    fetchMembers();
  }, [fetchEvents, fetchMembers, initialDate]);

  const generatedBirthdayEvents = useMemo(() => {
    const manualBirthdayKeys = new Set(
      apiEvents
        .filter(event => event.eventType === 'Sinh nhật')
        .flatMap(event => eventMemberIds(event).map(id => `${id}-${event.startDate}`))
    );
    return members.flatMap(member => {
      const birthday = memberBirthday(member);
      if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return [];
      const { month, day } = dateParts(birthday);
      if (!month || !day || month !== visibleMonth) return [];
      const date = `${visibleYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (manualBirthdayKeys.has(`${member.id}-${date}`)) return [];
      return [{
        id: `birthday-${member.id}-${visibleYear}`,
        title: `Sinh nhật ${member.name}`,
        startDate: date,
        startTime: '',
        allDay: true,
        calendarId: 'generated-birthday',
        eventType: 'Sinh nhật',
        type: 'Sinh nhật',
        source: 'generated-birthday' as const,
        readonly: true,
        color: '#f59e0b',
        visibility: 'all',
        allowedMemberIds: [],
        relatedMemberIds: [member.id],
        memberIds: [member.id],
      }];
    });
  }, [apiEvents, members, visibleMonth, visibleYear]);

  const fixedHolidayEvents = useMemo(() => VIETNAM_HOLIDAYS
    .filter(holiday => holiday.month === visibleMonth)
    .map(holiday => ({
      id: `holiday-${visibleYear}-${holiday.month}-${holiday.day}`,
      title: holiday.title,
      startDate: `${visibleYear}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
      startTime: '',
      allDay: true,
      calendarId: 'fixed-holiday',
      eventType: 'Ngày lễ',
      type: 'Ngày lễ',
      source: 'fixed-holiday' as const,
      readonly: true,
      color: '#ef4444',
      visibility: 'all',
      allowedMemberIds: [],
      relatedMemberIds: [],
      memberIds: [],
    })), [visibleMonth, visibleYear]);

  const displayEvents = useMemo(() => [
    ...apiEvents,
    ...generatedBirthdayEvents,
    ...fixedHolidayEvents,
  ], [apiEvents, fixedHolidayEvents, generatedBirthdayEvents]);

  const calendarEvents = useMemo(() => displayEvents.filter(event => {
    const matchesType = selectedType === 'all' || event.eventType === selectedType;
    const matchesMember = selectedMemberIds.length === 0 || eventMemberIds(event).some(id => selectedMemberIds.includes(id));
    return matchesType && matchesMember;
  }), [displayEvents, selectedMemberIds, selectedType]);

  const listDetailEvents = useMemo(() => {
    if (!selectedListType) return [];
    return displayEvents
      .filter(event => event.eventType === selectedListType)
      .sort((a, b) => `${a.startDate} ${a.startTime || '00:00'}`.localeCompare(`${b.startDate} ${b.startTime || '00:00'}`));
  }, [displayEvents, selectedListType]);

  const eventsByDate = useMemo(() => calendarEvents.reduce<Record<string, EventItem[]>>((acc, event) => {
    if (!acc[event.startDate]) acc[event.startDate] = [];
    acc[event.startDate].push(event);
    return acc;
  }, {}), [calendarEvents]);

  const selectedEvents = calendarEvents.filter(event => event.startDate === selectedDate);

  const upcomingEvents = useMemo(() => {
    const today = todayLocal();
    return [...displayEvents]
      .filter(event => event.startDate >= today)
      .sort((a, b) => `${a.startDate} ${a.startTime || '00:00'}`.localeCompare(`${b.startDate} ${b.startTime || '00:00'}`));
  }, [displayEvents]);

  const handleMonthChange = (date: any) => {
    setVisibleMonth(date.month);
    setVisibleYear(date.year);
    fetchEvents(new Date(date.year, date.month - 1, 1));
  };

  const openAddModal = () => {
    setEditingEvent(null);
    setDetailEvent(null);
    setFormTab('event');
    setFormTitle('');
    setFormCalendar('Gia đình');
    setFormStartDate(selectedDate);
    setFormStartTime('08:00');
    setFormEndDate(selectedDate);
    setFormEndTime('09:00');
    setFormAllDay(false);
    setFormRepeat('none');
    setFormReminder(0);
    setFormMemberIds(selectedMemberIds);
    setFormVisibility(selectedMemberIds.length ? 'custom' : 'all');
    setFormEventType(selectedListType || (selectedType !== 'all' ? selectedType : 'Gia đình'));
    setFormLocation('');
    setFormUrl('');
    setFormNote('');
    setFormTodoText('');
    setFormFileText('');
    setModalVisible(true);
  };

  const openEvent = (event: EventItem) => {
    if (event.readonly) {
      setDetailEvent(event);
      return;
    }
    setEditingEvent(event);
    setFormTab('event');
    setFormTitle(event.title);
    setFormCalendar(event.eventType === 'Khác' ? 'Khác' : event.eventType);
    setFormStartDate(event.startDate);
    setFormStartTime(event.startTime || '08:00');
    setFormEndDate(event.endDate || event.startDate);
    setFormEndTime(event.endTime || event.startTime || '09:00');
    setFormAllDay(event.allDay);
    setFormRepeat(event.repeatRule || 'none');
    setFormReminder(Number(event.reminderMinutes || 0));
    setFormMemberIds(eventMemberIds(event));
    setFormVisibility(event.visibility || 'all');
    setFormEventType(event.eventType || 'Gia đình');
    setFormLocation(event.location || '');
    setFormUrl(event.url || '');
    setFormNote(event.note || '');
    setFormTodoText(event.todoText || '');
    setFormFileText(event.fileText || '');
    setModalVisible(true);
  };

  const saveEvent = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên sự kiện');
      return;
    }
    try {
      setFormSaving(true);
      const type = formEventType || editingEvent?.eventType || (selectedType !== 'all' ? selectedType : selectedListType || 'Gia đình');
      const extraNote = [
        formNote.trim(),
        formUrl.trim() ? `URL: ${formUrl.trim()}` : '',
        formTodoText.trim() ? `To-do: ${formTodoText.trim()}` : '',
        formFileText.trim() ? `Tệp: ${formFileText.trim()}` : '',
      ].filter(Boolean).join('\n');
      const payload = {
        id: editingEvent?.id || makeId(),
        calendarId: editingEvent?.calendarId || 'default',
        title: formTitle.trim(),
        startDate: formStartDate,
        startTime: formAllDay ? null : formStartTime,
        endDate: formEndDate || formStartDate,
        endTime: formAllDay ? null : formEndTime,
        allDay: formAllDay,
        type,
        eventType: type,
        labelColor: eventColor(type),
        location: formLocation.trim(),
        note: extraNote,
        reminderMinutes: formReminder,
        repeatRule: formRepeat,
        visibility: formVisibility,
        allowedMemberIds: formVisibility === 'custom' ? formMemberIds : [],
        relatedMemberIds: formMemberIds,
        memberIds: formMemberIds,
      };
      if (editingEvent) await api.put('/api/events', payload);
      else await api.post('/api/events', payload);
      setModalVisible(false);
      setSelectedDate(formStartDate);
      fetchEvents(new Date(`${formStartDate}T00:00:00`));
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu sự kiện');
    } finally {
      setFormSaving(false);
    }
  };

  const deleteEvent = async (event: EventItem) => {
    if (event.readonly) return;
    Alert.alert('Xóa sự kiện', 'Bạn có chắc chắn muốn xóa sự kiện này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await api.delete(`/api/events?id=${event.id}`);
            fetchEvents(new Date(`${selectedDate}T00:00:00`));
          } catch (err: any) {
            Alert.alert('Lỗi', err.message || 'Không thể xóa sự kiện');
            setLoading(false);
          }
        },
      },
    ]);
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const renderReadonlyTag = (event: EventItem) => {
    if (!event.readonly) return null;
    return (
      <View style={styles.readonlyBadge}>
        <Text style={styles.readonlyText}>{event.source === 'fixed-holiday' ? 'Cố định' : 'Tự động'}</Text>
      </View>
    );
  };

  const renderDay = ({ date, state }: any) => {
    const isToday = state === 'today';
    const isSelected = date.dateString === selectedDate;
    const isDisabled = state === 'disabled';
    const dayEvents = eventsByDate[date.dateString] || [];
    return (
      <TouchableOpacity style={[styles.dayContainer, isSelected && styles.selectedDayContainer]} onPress={() => setSelectedDate(date.dateString)} activeOpacity={0.75}>
        <View style={[styles.dayCircle, isToday && styles.todayCircle, isSelected && styles.activeDayCircle]}>
          <Text style={[styles.dayText, isDisabled && styles.disabledDayText, isToday && styles.todayText, isSelected && styles.activeDayText]}>{date.day}</Text>
        </View>
        <View style={styles.eventPillsContainer}>
          {dayEvents.slice(0, 2).map(event => {
            const color = event.color || eventColor(event.eventType);
            return (
              <TouchableOpacity key={event.id} style={[styles.miniEventPill, { backgroundColor: `${color}18` }]} onPress={() => openEvent(event)}>
                <View style={[styles.miniEventDot, { backgroundColor: color }]} />
                <Text numberOfLines={1} style={[styles.miniEventText, { color }]}>{event.allDay ? '' : `${event.startTime} `}{event.title}</Text>
              </TouchableOpacity>
            );
          })}
          {dayEvents.length > 2 && <Text style={styles.moreEventsText}>+{dayEvents.length - 2} sự kiện</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventCard = (item: EventItem) => {
    const color = item.color || eventColor(item.eventType);
    const relatedNames = memberNamesForEvent(item, members);
    return (
      <TouchableOpacity key={item.id} style={[styles.eventCard, { borderLeftColor: color }]} onPress={() => openEvent(item)} activeOpacity={0.82}>
        <View style={styles.eventInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            {renderReadonlyTag(item)}
          </View>
          <View style={styles.eventMetaRow}>
            <Clock size={13} color="#64748b" />
            <Text style={styles.eventTime}>{formatDate(item.startDate)} • {item.allDay ? 'Cả ngày' : item.startTime || '08:00'}</Text>
            <View style={[styles.typeBadge, { backgroundColor: `${color}16` }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{item.eventType}</Text>
            </View>
          </View>
          {relatedNames ? <Text style={styles.relatedText}>Liên quan: {relatedNames}</Text> : null}
        </View>
        {!item.readonly && (
          <TouchableOpacity onPress={() => deleteEvent(item)} style={styles.deleteButton}>
            <Trash2 size={19} color="#ef4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderCalendarFilter = () => (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Lọc loại sự kiện</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {EVENT_FILTERS.map(filter => {
          const active = selectedType === filter.key;
          const count = filter.key === 'all' ? displayEvents.length : displayEvents.filter(event => event.eventType === filter.key).length;
          return (
            <TouchableOpacity key={filter.key} style={[styles.filterChip, active && styles.activeFilterChip]} onPress={() => setSelectedType(filter.key)} activeOpacity={0.78}>
              <View style={[styles.filterDot, { backgroundColor: filter.color }]} />
              <Text style={[styles.filterText, active && styles.activeFilterText]}>{filter.label}</Text>
              <Text style={[styles.filterCount, active && styles.activeFilterCount]}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderCalendarView = () => (
    <>
      {renderCalendarFilter()}
      <View style={styles.calendarContainer}>
        <Calendar
          current={selectedDate}
          onMonthChange={handleMonthChange}
          firstDay={1}
          dayComponent={renderDay}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#64748b',
            textDayHeaderFontWeight: '500',
            arrowColor: '#4f46e5',
            monthTextColor: '#0f172a',
            textMonthFontWeight: '600',
            textMonthFontSize: 18,
            todayTextColor: '#4f46e5',
          }}
          style={styles.calendarWidget}
        />
      </View>
      <View style={styles.eventListContainer}>
        <Text style={styles.listTitle}>Ngày {formatDate(selectedDate)}</Text>
        {loading && !apiEvents.length ? (
          <ActivityIndicator size="large" color="#4f46e5" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchEvents(new Date(`${selectedDate}T00:00:00`))}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : selectedEvents.length > 0 ? (
          <FlatList data={selectedEvents} keyExtractor={item => item.id} renderItem={({ item }) => renderEventCard(item)} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
        ) : (
          <View style={styles.emptyContainer}>
            <CalendarDays size={28} color="#94a3b8" />
            <Text style={styles.emptyText}>Không có sự kiện nào.</Text>
          </View>
        )}
      </View>
    </>
  );

  const renderListsView = () => {
    if (selectedListType) {
      const color = eventColor(selectedListType);
      return (
        <View style={styles.listScreen}>
          <TouchableOpacity style={styles.backRow} onPress={() => setSelectedListType(null)}>
            <ChevronLeft size={18} color="#4f46e5" />
            <Text style={styles.backText}>Danh sách</Text>
          </TouchableOpacity>
          <View style={[styles.listHeaderCard, { borderLeftColor: color }]}>
            <Text style={styles.listHeaderTitle}>{selectedListType}</Text>
            <Text style={styles.listHeaderSub}>{listDetailEvents.length} sự kiện trong tháng</Text>
          </View>
          <FlatList
            data={listDetailEvents}
            keyExtractor={item => item.id}
            renderItem={({ item }) => renderEventCard(item)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptySmallText}>Chưa có sự kiện trong danh sách này.</Text>}
          />
        </View>
      );
    }

    return (
      <ScrollView style={styles.activityContainer} contentContainerStyle={styles.listDirectoryContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Danh sách lịch</Text>
        {EVENT_TYPES.map(item => {
          const count = displayEvents.filter(event => event.eventType === item.key).length;
          const relatedMemberIds = new Set(displayEvents.filter(event => event.eventType === item.key).flatMap(eventMemberIds));
          const avatars = members.filter(member => relatedMemberIds.has(member.id)).slice(0, 3);
          return (
            <TouchableOpacity key={item.key} style={styles.calendarListCard} onPress={() => setSelectedListType(item.key)} activeOpacity={0.82}>
              <View style={[styles.listColorBlock, { backgroundColor: item.color }]} />
              <View style={styles.calendarListInfo}>
                <Text style={styles.calendarListTitle}>{item.label}</Text>
                <Text style={styles.calendarListSub}>{count} sự kiện trong tháng</Text>
              </View>
              <View style={styles.avatarStack}>
                {avatars.map(member => {
                  const avatar = member.avatarUrl || member.avatar_url || member.avatar;
                  return avatar ? <Image key={member.id} source={{ uri: avatar }} style={styles.stackAvatar} /> : <View key={member.id} style={[styles.stackAvatarFallback, { backgroundColor: `${member.color || '#4f46e5'}20` }]}><Text style={styles.stackAvatarText}>{member.name.charAt(0).toUpperCase()}</Text></View>;
                })}
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addListCard} activeOpacity={0.78}>
          <Plus size={18} color="#4f46e5" />
          <Text style={styles.addListText}>Thêm danh sách</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderShareView = () => (
    <>
      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.panelTitle}>Thành viên chia sẻ</Text>
          {selectedMemberIds.length > 0 && (
            <TouchableOpacity onPress={() => setSelectedMemberIds([])}>
              <Text style={styles.clearText}>Bỏ chọn</Text>
            </TouchableOpacity>
          )}
        </View>
        {membersLoading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 14 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
            {members.map(member => {
              const avatar = member.avatarUrl || member.avatar_url || member.avatar;
              const active = selectedMemberIds.includes(member.id);
              return (
                <TouchableOpacity key={member.id} style={[styles.memberChip, active && styles.activeMemberChip]} onPress={() => toggleMember(member.id)} activeOpacity={0.78}>
                  {avatar ? <Image source={{ uri: avatar }} style={styles.memberAvatar} /> : (
                    <View style={[styles.memberFallback, { backgroundColor: `${member.color || '#4f46e5'}18` }]}>
                      <Text style={[styles.memberInitial, { color: member.color || '#4f46e5' }]}>{member.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={[styles.memberName, active && styles.activeMemberName]}>{member.name}</Text>
                  <View style={[styles.memberCheck, active && styles.activeMemberCheck]}>{active && <Check size={12} color="#ffffff" />}</View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <Text style={styles.shareHint}>Dùng cho quyền xem và người liên quan: visibility, allowedMemberIds, relatedMemberIds.</Text>
      </View>
      {renderCalendarView()}
    </>
  );

  const renderActionView = () => (
    <ScrollView style={styles.activityContainer} contentContainerStyle={styles.activityContent} showsVerticalScrollIndicator={false}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Sự kiện sắp tới</Text>
        {upcomingEvents.length > 0 ? (
          <View style={styles.upcomingList}>
            {upcomingEvents.slice(0, 20).map(event => renderEventCard(event))}
          </View>
        ) : (
          <View style={styles.activityEmpty}>
            <CalendarDays size={30} color="#94a3b8" />
            <Text style={styles.emptySmallText}>Chưa có sự kiện sắp tới.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const labelFor = (items: any[], value: any) => items.find(item => item.value === value)?.label || String(value);
  const selectedFormMembers = members.filter(member => formMemberIds.includes(member.id)).map(member => member.name).join(', ');

  const renderSelectRow = (label: string, value: string, sheet: typeof choiceSheet) => (
    <TouchableOpacity style={styles.selectRow} onPress={() => setChoiceSheet(sheet)} activeOpacity={0.78}>
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectValueWrap}>
        <Text numberOfLines={1} style={styles.selectValue}>{value}</Text>
        <ChevronRight size={18} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );

  const renderChoiceSheet = () => {
    if (!choiceSheet) return null;
    const close = () => setChoiceSheet(null);
    const select = (fn: () => void) => {
      fn();
      close();
    };
    let title = '';
    let content: React.ReactNode = null;

    if (choiceSheet === 'calendar') {
      title = 'Lịch';
      content = CALENDAR_OPTIONS.map(item => (
        <TouchableOpacity key={item} style={styles.sheetItem} onPress={() => select(() => setFormCalendar(item))}>
          <Text style={styles.sheetItemText}>{item}</Text>
          {formCalendar === item && <Check size={18} color="#4f46e5" />}
        </TouchableOpacity>
      ));
    }
    if (choiceSheet === 'repeat') {
      title = 'Lặp lại';
      content = REPEAT_OPTIONS.map(item => (
        <TouchableOpacity key={item.value} style={styles.sheetItem} onPress={() => select(() => setFormRepeat(item.value))}>
          <Text style={styles.sheetItemText}>{item.label}</Text>
          {formRepeat === item.value && <Check size={18} color="#4f46e5" />}
        </TouchableOpacity>
      ));
    }
    if (choiceSheet === 'reminder') {
      title = 'Nhắc trước';
      content = REMINDER_OPTIONS.map(item => (
        <TouchableOpacity key={item.value} style={styles.sheetItem} onPress={() => select(() => setFormReminder(item.value))}>
          <Text style={styles.sheetItemText}>{item.label}</Text>
          {formReminder === item.value && <Check size={18} color="#4f46e5" />}
        </TouchableOpacity>
      ));
    }
    if (choiceSheet === 'visibility') {
      title = 'Quyền xem';
      content = VISIBILITY_OPTIONS.map(item => (
        <TouchableOpacity key={item.value} style={styles.sheetItem} onPress={() => select(() => setFormVisibility(item.value))}>
          <Text style={styles.sheetItemText}>{item.label}</Text>
          {formVisibility === item.value && <Check size={18} color="#4f46e5" />}
        </TouchableOpacity>
      ));
    }
    if (choiceSheet === 'label') {
      title = 'Nhãn màu / Loại sự kiện';
      content = EVENT_TYPES.map(item => (
        <TouchableOpacity key={item.key} style={styles.sheetItem} onPress={() => select(() => setFormEventType(item.key))}>
          <View style={[styles.sheetColorDot, { backgroundColor: item.color }]} />
          <Text style={styles.sheetItemText}>{item.label}</Text>
          {formEventType === item.key && <Check size={18} color="#4f46e5" />}
        </TouchableOpacity>
      ));
    }
    if (choiceSheet === 'members') {
      title = 'Thành viên';
      content = members.map(member => {
        const active = formMemberIds.includes(member.id);
        const avatar = member.avatarUrl || member.avatar_url || member.avatar;
        return (
          <TouchableOpacity key={member.id} style={styles.sheetItem} onPress={() => setFormMemberIds(prev => active ? prev.filter(id => id !== member.id) : [...prev, member.id])}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.sheetAvatar} /> : <View style={[styles.sheetAvatarFallback, { backgroundColor: `${member.color || '#4f46e5'}20` }]}><Text style={styles.stackAvatarText}>{member.name.charAt(0).toUpperCase()}</Text></View>}
            <Text style={styles.sheetItemText}>{member.name}</Text>
            {active && <Check size={18} color="#4f46e5" />}
          </TouchableOpacity>
        );
      });
    }

    return (
      <Modal visible transparent animationType="slide" onRequestClose={close}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={close}><X size={24} color="#64748b" /></TouchableOpacity>
            </View>
            <ScrollView>{content}</ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabsCard}>
        {TAB_ITEMS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.innerTab, active && styles.activeInnerTab]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Text style={[styles.innerTabText, active && styles.activeInnerTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'calendar' && renderCalendarView()}
      {activeTab === 'lists' && renderListsView()}
      {activeTab === 'share' && renderShareView()}
      {activeTab === 'action' && renderActionView()}

      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
        <Plus size={26} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={Boolean(detailEvent)} animationType="slide" transparent onRequestClose={() => setDetailEvent(null)}>
        <View style={styles.modalOverlay}>
          {detailEvent && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{detailEvent.title}</Text>
                <TouchableOpacity onPress={() => setDetailEvent(null)}><X size={24} color="#64748b" /></TouchableOpacity>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Ngày</Text>
                <Text style={styles.detailValue}>{formatDate(detailEvent.startDate)}</Text>
                <Text style={styles.detailLabel}>Loại</Text>
                <Text style={[styles.detailValue, { color: detailEvent.color || eventColor(detailEvent.eventType) }]}>{detailEvent.eventType}</Text>
                <Text style={styles.detailLabel}>Nguồn</Text>
                <Text style={styles.detailValue}>{detailEvent.source === 'fixed-holiday' ? 'Cố định' : 'Tự động'}</Text>
                {memberNamesForEvent(detailEvent, members) ? (
                  <>
                    <Text style={styles.detailLabel}>Liên quan</Text>
                    <Text style={styles.detailValue}>{memberNamesForEvent(detailEvent, members)}</Text>
                  </>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#64748b" /></TouchableOpacity>
              <Text style={styles.modalTitle}>{editingEvent ? 'Sửa sự kiện' : 'Tạo sự kiện'}</Text>
              <TouchableOpacity onPress={saveEvent} disabled={formSaving} style={styles.headerSaveButton}>
                {formSaving ? <ActivityIndicator color="#4f46e5" /> : <Text style={styles.headerSaveText}>Lưu</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.formTabs}>
              <TouchableOpacity style={[styles.formTab, formTab === 'event' && styles.activeFormTab]} onPress={() => setFormTab('event')}>
                <Text style={[styles.formTabText, formTab === 'event' && styles.activeFormTabText]}>Sự kiện</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formTab, formTab === 'note' && styles.activeFormTab]} onPress={() => setFormTab('note')}>
                <Text style={[styles.formTabText, formTab === 'note' && styles.activeFormTabText]}>Ghi chú</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {formTab === 'event' ? (
                <>
                  <Text style={styles.inputLabel}>Tên sự kiện</Text>
                  <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Nhập tên sự kiện" placeholderTextColor="#94a3b8" />

                  {renderSelectRow('Lịch', formCalendar, 'calendar')}
                  <View style={styles.switchRow}>
                    <Text style={styles.inputLabel}>Cả ngày</Text>
                    <Switch value={formAllDay} onValueChange={setFormAllDay} trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }} thumbColor={formAllDay ? '#4f46e5' : '#f8fafc'} />
                  </View>

                  <Text style={styles.inputLabel}>Bắt đầu</Text>
                  <View style={styles.twoColumnRow}>
                    <TextInput style={[styles.input, styles.twoColumnInput]} value={formStartDate} onChangeText={setFormStartDate} placeholder="yyyy-mm-dd" placeholderTextColor="#94a3b8" />
                    <TextInput style={[styles.input, styles.twoColumnInput]} value={formStartTime} onChangeText={setFormStartTime} editable={!formAllDay} placeholder="HH:mm" keyboardType="numbers-and-punctuation" placeholderTextColor="#94a3b8" />
                  </View>

                  <Text style={styles.inputLabel}>Kết thúc</Text>
                  <View style={styles.twoColumnRow}>
                    <TextInput style={[styles.input, styles.twoColumnInput]} value={formEndDate} onChangeText={setFormEndDate} placeholder="yyyy-mm-dd" placeholderTextColor="#94a3b8" />
                    <TextInput style={[styles.input, styles.twoColumnInput]} value={formEndTime} onChangeText={setFormEndTime} editable={!formAllDay} placeholder="HH:mm" keyboardType="numbers-and-punctuation" placeholderTextColor="#94a3b8" />
                  </View>

                  {renderSelectRow('Lặp lại', labelFor(REPEAT_OPTIONS, formRepeat), 'repeat')}
                  {renderSelectRow('Nhắc trước', labelFor(REMINDER_OPTIONS, formReminder), 'reminder')}
                  {renderSelectRow('Thành viên', selectedFormMembers || 'Chưa chọn', 'members')}
                  {renderSelectRow('Quyền xem', labelFor(VISIBILITY_OPTIONS, formVisibility), 'visibility')}
                  {renderSelectRow('Nhãn màu / Loại sự kiện', formEventType, 'label')}

                  <Text style={styles.inputLabel}>Địa điểm</Text>
                  <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholder="Nhập địa điểm" placeholderTextColor="#94a3b8" />

                  <Text style={styles.inputLabel}>URL</Text>
                  <TextInput style={styles.input} value={formUrl} onChangeText={setFormUrl} placeholder="https://..." placeholderTextColor="#94a3b8" autoCapitalize="none" />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Ghi chú</Text>
                  <TextInput style={[styles.input, styles.multiInput]} value={formNote} onChangeText={setFormNote} placeholder="Thêm ghi chú" placeholderTextColor="#94a3b8" multiline />

                  <Text style={styles.inputLabel}>To-do list</Text>
                  <TextInput style={[styles.input, styles.multiInput]} value={formTodoText} onChangeText={setFormTodoText} placeholder="Mỗi dòng là một việc cần làm" placeholderTextColor="#94a3b8" multiline />

                  <Text style={styles.inputLabel}>Tệp</Text>
                  <TextInput style={styles.input} value={formFileText} onChangeText={setFormFileText} placeholder="Tên tệp hoặc đường dẫn" placeholderTextColor="#94a3b8" />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {renderChoiceSheet()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 34 : 8 },
  tabsCard: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, marginBottom: 12, padding: 4, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  innerTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14 },
  activeInnerTab: { backgroundColor: '#4f46e5' },
  innerTabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  activeInnerTabText: { color: '#ffffff', fontWeight: '600' },
  panel: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  chipRow: { gap: 8, paddingRight: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  activeFilterChip: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  activeFilterText: { color: '#312e81' },
  filterCount: { minWidth: 20, overflow: 'hidden', textAlign: 'center', borderRadius: 999, backgroundColor: '#e2e8f0', color: '#64748b', fontSize: 12, fontWeight: '600', paddingHorizontal: 6 },
  activeFilterCount: { backgroundColor: '#c7d2fe', color: '#3730a3' },
  memberRow: { gap: 10, paddingRight: 4 },
  memberChip: { width: 100, alignItems: 'center', padding: 10, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  activeMemberChip: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 8 },
  memberFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  memberInitial: { fontSize: 17, fontWeight: '600' },
  memberName: { maxWidth: 78, fontSize: 12, fontWeight: '500', color: '#475569' },
  activeMemberName: { color: '#312e81' },
  memberCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  activeMemberCheck: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  clearText: { fontSize: 13, fontWeight: '600', color: '#4f46e5', marginBottom: 12 },
  shareHint: { marginTop: 12, fontSize: 12, lineHeight: 17, color: '#64748b' },
  activityContainer: { flex: 1, backgroundColor: '#f8fafc' },
  activityContent: { paddingBottom: 130 },
  upcomingList: { gap: 10 },
  activityEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 38, gap: 10 },
  emptySmallText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  calendarContainer: { marginHorizontal: 16, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, overflow: 'hidden' },
  calendarWidget: { paddingBottom: 10 },
  dayContainer: { width: '100%', minHeight: 70, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 2, borderRadius: 10 },
  selectedDayContainer: { backgroundColor: '#eef2ff' },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  todayCircle: { backgroundColor: '#e0e7ff' },
  activeDayCircle: { backgroundColor: '#4f46e5' },
  dayText: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  disabledDayText: { color: '#cbd5e1' },
  todayText: { color: '#4f46e5', fontWeight: '600' },
  activeDayText: { color: '#ffffff', fontWeight: '600' },
  eventPillsContainer: { width: '100%', gap: 2 },
  miniEventPill: { minHeight: 17, borderRadius: 7, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniEventDot: { width: 5, height: 5, borderRadius: 3 },
  miniEventText: { flex: 1, fontSize: 9, fontWeight: '600' },
  moreEventsText: { fontSize: 9, color: '#4f46e5', fontWeight: '600', marginTop: 1 },
  eventListContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#f8fafc' },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  loader: { marginTop: 30 },
  errorContainer: { alignItems: 'center', marginTop: 20 },
  errorText: { color: '#ef4444', textAlign: 'center' },
  retryButton: { backgroundColor: '#4f46e5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 130, gap: 10 },
  eventCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1, borderLeftWidth: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  eventInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 7 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  eventTime: { fontSize: 13, color: '#64748b' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  readonlyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#f1f5f9' },
  readonlyText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  relatedText: { marginTop: 6, fontSize: 12, color: '#64748b' },
  deleteButton: { padding: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 34, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 14, marginHorizontal: 4 },
  listDirectoryContent: { paddingHorizontal: 16, paddingBottom: 130 },
  calendarListCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  listColorBlock: { width: 48, height: 48, borderRadius: 16, marginRight: 12 },
  calendarListInfo: { flex: 1 },
  calendarListTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  calendarListSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  avatarStack: { flexDirection: 'row', marginRight: 10 },
  stackAvatar: { width: 24, height: 24, borderRadius: 12, marginLeft: -6, borderWidth: 2, borderColor: '#ffffff' },
  stackAvatarFallback: { width: 24, height: 24, borderRadius: 12, marginLeft: -6, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  stackAvatarText: { fontSize: 10, fontWeight: '600', color: '#4f46e5' },
  addListCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  addListText: { fontSize: 15, fontWeight: '600', color: '#4f46e5' },
  listScreen: { flex: 1, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  listHeaderCard: { padding: 16, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5, marginBottom: 14 },
  listHeaderTitle: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
  listHeaderSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  fab: { position: 'absolute', right: 22, bottom: Platform.OS === 'web' ? 96 : 118, backgroundColor: '#4f46e5', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, zIndex: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: '600', color: '#0f172a', paddingRight: 12 },
  headerSaveButton: { minWidth: 48, alignItems: 'flex-end', paddingVertical: 6 },
  headerSaveText: { fontSize: 16, fontWeight: '600', color: '#4f46e5' },
  formTabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#f1f5f9', marginBottom: 18 },
  formTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  activeFormTab: { backgroundColor: '#ffffff', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  formTabText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  activeFormTabText: { color: '#4f46e5', fontWeight: '600' },
  modalBody: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 14, fontSize: 16, marginBottom: 18, color: '#0f172a' },
  multiInput: { minHeight: 110, textAlignVertical: 'top' },
  twoColumnRow: { flexDirection: 'row', gap: 10 },
  twoColumnInput: { flex: 1 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 4 },
  selectLabel: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  selectValueWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', marginLeft: 12 },
  selectValue: { maxWidth: 190, fontSize: 14, color: '#64748b', marginRight: 4 },
  sheetContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, maxHeight: '78%' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  sheetItemText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#0f172a' },
  sheetColorDot: { width: 14, height: 14, borderRadius: 7 },
  sheetAvatar: { width: 34, height: 34, borderRadius: 17 },
  sheetAvatarFallback: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  datePreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#eef2ff', marginBottom: 18 },
  datePreviewText: { fontSize: 14, fontWeight: '600', color: '#312e81' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalCancelButton: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#f1f5f9', marginRight: 10 },
  modalCancelText: { color: '#475569', fontWeight: '600', fontSize: 16 },
  modalSaveButton: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#4f46e5', marginLeft: 10 },
  modalSaveText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  detailCard: { borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 6 },
  detailLabel: { fontSize: 12, color: '#64748b', marginTop: 6 },
  detailValue: { fontSize: 15, color: '#0f172a', fontWeight: '600' },
});
