import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NoticeProvider } from './context/NoticeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Search from './pages/Search';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import FileManager from './pages/FileManager';
import Detail from './pages/Detail';
import MediaDetail from './pages/MediaDetail';
import Player from './pages/Player';

export default function App() {
  return (
    <AuthProvider>
      <NoticeProvider>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/series" element={<Series />} />
            <Route path="/search" element={<Search />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/files" element={<FileManager />} />
            <Route path="/media/:id" element={<MediaDetail />} />
            <Route path="/detail/:type/:id" element={<Detail />} />
          </Route>
          <Route path="/watch/:id" element={<Player />} />
        </Route>
      </Routes>
      </NoticeProvider>
    </AuthProvider>
  );
}
