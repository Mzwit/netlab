import { Component, lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Dashboard, ProtocolList, ProtocolPage, SimList, SimPage, SearchPage, SavedPage, NotFound } from './pages/Explore';
const OsiLab = lazy(() => import('./pages/Osi'));
const T = () => import('./pages/Tools');
const ToolsIndex = lazy(() => T().then((m) => ({ default: m.ToolsIndex })));
const ToolPage = lazy(() => T().then((m) => ({ default: m.ToolPage })));
const L = () => import('./pages/Learn');
const lz = (k: 'LearnIndex' | 'CoursePage' | 'LessonPage' | 'Exams' | 'ProgressPage' | 'Glossary' | 'SettingsPage') => lazy(() => L().then((m) => ({ default: m[k] })));
const LearnIndex = lz('LearnIndex'), CoursePage = lz('CoursePage'), LessonPage = lz('LessonPage'), Exams = lz('Exams'), ProgressPage = lz('ProgressPage'), Glossary = lz('Glossary'), SettingsPage = lz('SettingsPage');

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return (
      <div className="panel mx-auto mt-10 max-w-lg p-6 text-center">
        <h2 className="h2">Something went wrong</h2>
        <p className="mt-2 font-mono text-sm text-rose-300">{this.state.err.message}</p>
        <button className="btn btn-primary mt-4" onClick={() => { this.setState({ err: null }); location.hash = '#/'; }}>Back to dashboard</button>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Boundary>
          <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500" role="status">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/protocols" element={<ProtocolList />} />
            <Route path="/protocols/:id" element={<ProtocolPage />} />
            <Route path="/simulations" element={<SimList kind="guided" />} />
            <Route path="/simulations/:id" element={<SimPage kind="guided" />} />
            <Route path="/security" element={<SimList kind="attack" />} />
            <Route path="/security/:id" element={<SimPage kind="attack" />} />
            <Route path="/osi" element={<OsiLab />} />
            <Route path="/tools" element={<ToolsIndex />} />
            <Route path="/tools/:id" element={<ToolPage />} />
            <Route path="/learn" element={<LearnIndex />} />
            <Route path="/learn/:course" element={<CoursePage />} />
            <Route path="/learn/:course/:lesson" element={<LessonPage />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </Boundary>
      </Layout>
    </HashRouter>
  );
}
