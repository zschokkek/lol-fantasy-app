// frontend/src/layouts/LeagueLayout.js
import React from 'react';
import { Box } from '@chakra-ui/react';
import LeagueNavbar from '../components/LeagueNavbar';

const LeagueLayout = ({ children }) => {
  return (
    <Box minH="100vh" bg="gray.900" color="white" overflowX="hidden" overscrollBehavior="none">
      <LeagueNavbar />
      <Box 
        maxW="container.xl" 
        mx="auto" 
        px={{ base: 4, md: 6 }} 
        py={{ base: 6, md: 8 }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default LeagueLayout;
