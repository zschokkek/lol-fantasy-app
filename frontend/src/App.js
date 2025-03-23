// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-ui/react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Players from './pages/Players';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import PlayerDetail from './pages/PlayerDetail';
import League from './pages/League';
import Leagues from './pages/Leagues';
import LeagueDetail from './pages/LeagueDetail';
import Matchups from './pages/Matchups';
import Standings from './pages/Standings';
import Draft from './pages/Draft';
import Trade from './pages/Trade';
import Friends from './pages/Friends';
import Conversation from './pages/Conversation';
import ProtectedRoute from './components/ProtectedRoute';
import LeagueRequiredRoute from './components/LeagueRequiredRoute';
import { AuthProvider } from './context/AuthContext';
import { ApiProvider } from './context/ApiContext';
import { LeagueProvider } from './context/LeagueContext';

function App() {
  return (
    <ChakraProvider>
      <AuthProvider>
        <ApiProvider>
          <LeagueProvider>
            <Router>
              <Box minH="100vh" bg="gray.900" color="white" overflowX="hidden" overscrollBehavior="none">
                <Navbar />
                <Box 
                  maxW="container.xl" 
                  mx="auto" 
                  px={{ base: 4, md: 6 }} 
                  py={{ base: 6, md: 8 }}
                >
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    
                    {/* Protected routes */}
                    <Route path="/players" element={
                      <ProtectedRoute>
                        <LeagueRequiredRoute>
                          <Players />
                        </LeagueRequiredRoute>
                      </ProtectedRoute>
                    } />
                    <Route path="/players/:id" element={
                      <ProtectedRoute>
                        <LeagueRequiredRoute>
                          <PlayerDetail />
                        </LeagueRequiredRoute>
                      </ProtectedRoute>
                    } />
                    <Route path="/leagues" element={
                      <ProtectedRoute>
                        <Leagues />
                      </ProtectedRoute>
                    } />
                    <Route path="/leagues/:id" element={
                      <ProtectedRoute>
                        <LeagueDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="/teams" element={
                      <ProtectedRoute>
                        <Teams />
                      </ProtectedRoute>
                    } />
                    <Route path="/teams/:id" element={
                      <ProtectedRoute>
                        <TeamDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="/trade/:id" element={
                      <ProtectedRoute>
                        <Trade />
                      </ProtectedRoute>
                    } />
                    <Route path="/league" element={
                      <ProtectedRoute>
                        <League />
                      </ProtectedRoute>
                    } />
                    <Route path="/matchups" element={
                      <ProtectedRoute>
                        <LeagueRequiredRoute>
                          <Matchups />
                        </LeagueRequiredRoute>
                      </ProtectedRoute>
                    } />
                    <Route path="/standings" element={
                      <ProtectedRoute>
                        <LeagueRequiredRoute>
                          <Standings />
                        </LeagueRequiredRoute>
                      </ProtectedRoute>
                    } />
                    <Route path="/draft" element={
                      <ProtectedRoute>
                        <LeagueRequiredRoute>
                          <Draft />
                        </LeagueRequiredRoute>
                      </ProtectedRoute>
                    } />
                    
                    {/* Friends and Messaging routes */}
                    <Route path="/friends" element={
                      <ProtectedRoute>
                        <Friends />
                      </ProtectedRoute>
                    } />
                    <Route path="/messages" element={
                      <Navigate to="/friends?tab=messages" replace />
                    } />
                    <Route path="/messages/:id" element={
                      <ProtectedRoute>
                        <Conversation />
                      </ProtectedRoute>
                    } />
                  </Routes>
                </Box>
              </Box>
            </Router>
          </LeagueProvider>
        </ApiProvider>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;