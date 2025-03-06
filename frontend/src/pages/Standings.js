import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, 
  Link, Text, Spinner, Button, Flex, useToast, Center
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import { useLeague } from '../context/LeagueContext';

const Standings = () => {
  const { getStandings, updateAllStats, loading, error } = useApi();
  const { league } = useLeague();
  const [standings, setStandings] = useState([]);
  const toast = useToast();
  
  useEffect(() => {
    if (league) {
      fetchStandings();
    }
  }, [league]);
  
  const fetchStandings = async () => {
    try {
      const data = await getStandings(league.id);
      setStandings(data);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };
  
  const handleUpdateStats = async () => {
    try {
      await updateAllStats(league.id);
      
      toast({
        title: 'Stats Updated',
        description: 'All player stats have been successfully updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh standings
      fetchStandings();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update stats',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  if (loading && standings.length === 0) {
    return (
      <Center h="200px">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="teal.400"
          size="xl"
        />
      </Center>
    );
  }
  
  if (error) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="red.500">
        <Heading size="md" color="red.400" mb={2}>Error Loading Standings</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading color="white">League Standings</Heading>
        <Button 
          colorScheme="teal" 
          onClick={handleUpdateStats}
          isLoading={loading}
        >
          Update All Stats
        </Button>
      </Flex>
      
      <Box bg="gray.800" rounded="md" shadow="lg" overflowX="auto" borderWidth={1} borderColor="gray.700">
        {standings.length > 0 ? (
          <Table variant="simple">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Rank</Th>
                <Th color="gray.400">Team</Th>
                <Th isNumeric color="gray.400">W</Th>
                <Th isNumeric color="gray.400">L</Th>
                <Th isNumeric color="gray.400">Win %</Th>
                <Th isNumeric color="gray.400">Fantasy Points</Th>
              </Tr>
            </Thead>
            <Tbody>
              {standings.map((standing, index) => (
                <Tr key={standing.team.id} _hover={{ bg: "gray.700" }}>
                  <Td fontWeight="bold" color="white">{index + 1}</Td>
                  <Td>
                    <Link as={RouterLink} to={`/teams/${standing.team.id}`} color="teal.300" fontWeight="semibold" _hover={{ color: "teal.200" }}>
                      {standing.team.name}
                    </Link>
                    <Text fontSize="sm" color="gray.400">
                      {standing.team.owner}
                    </Text>
                  </Td>
                  <Td isNumeric color="white">{standing.wins}</Td>
                  <Td isNumeric color="white">{standing.losses}</Td>
                  <Td isNumeric color="white">
                    {(standing.wins + standing.losses) > 0
                      ? ((standing.wins / (standing.wins + standing.losses)) * 100).toFixed(1) + '%'
                      : '-'}
                  </Td>
                  <Td isNumeric fontWeight="bold" color="teal.300">
                    {standing.totalPoints.toFixed(1)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <Box p={6} textAlign="center">
            <Text color="gray.400">No standings data available yet</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Standings;