// frontend/src/components/LeagueRequiredRoute.js
import React from 'react';
import { Navigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { Box, Heading, Text, Button, VStack, Center } from '@chakra-ui/react';

const LeagueRequiredRoute = ({ children }) => {
  const { selectedLeague, loading } = useLeague();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="200px">
        <Box textAlign="center">
          <Text color="gray.400">Loading league information...</Text>
        </Box>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!selectedLeague) {
    return (
      <Box p={8} maxW="container.md" mx="auto">
        <VStack spacing={6} align="center" textAlign="center">
          <Heading size="lg" color="white">Select a League First</Heading>
          <Text color="gray.300">
            You need to select a league before you can access this page.
          </Text>
          <Button 
            as={RouterLink} 
            to="/leagues" 
            colorScheme="teal" 
            size="lg"
          >
            Go to My Leagues
          </Button>
        </VStack>
      </Box>
    );
  }

  return children;
};

export default LeagueRequiredRoute;
