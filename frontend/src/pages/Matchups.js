import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, SimpleGrid, Text, Flex, Link, 
  Badge, Select, Button, Spinner, useToast,
  Center
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';

const MatchupCard = ({ matchup }) => {
  return (
    <Box 
      bg="gray.800" 
      p={4}
      rounded="md" 
      shadow="md" 
      borderWidth={1}
      borderColor="gray.700"
      position="relative"
      transition="transform 0.2s"
      _hover={{ transform: 'translateY(-2px)' }}
    >
      {matchup.completed && (
        <Badge 
          position="absolute" 
          top={2} 
          right={2} 
          colorScheme="teal"
        >
          Completed
        </Badge>
      )}
      
      <Text textAlign="center" fontSize="sm" color="gray.400" mb={3}>
        Week {matchup.week} • Match {matchup.id.split('_').pop()}
      </Text>
      
      <Flex 
        justify="space-between" 
        align="center" 
        p={3}
        bg={
          matchup.completed && matchup.homeScore > matchup.awayScore
            ? 'teal.900'
            : 'gray.700'
        }
        rounded="md"
        borderWidth={1}
        borderColor="gray.600"
        mb={2}
      >
        <Link as={RouterLink} to={`/teams/${matchup.homeTeam.id}`} fontWeight="bold" color="white">
          {matchup.homeTeam.name}
        </Link>
        <Text 
          fontWeight="bold" 
          fontSize="xl"
          color={
            matchup.completed && matchup.homeScore > matchup.awayScore
              ? 'teal.200'
              : 'white'
          }
        >
          {matchup.homeScore.toFixed(1)}
        </Text>
      </Flex>
      
      <Flex 
        justify="space-between" 
        align="center"
        p={3}
        bg={
          matchup.completed && matchup.awayScore > matchup.homeScore
            ? 'teal.900'
            : 'gray.700'
        }
        rounded="md"
        borderWidth={1}
        borderColor="gray.600"
      >
        <Link as={RouterLink} to={`/teams/${matchup.awayTeam.id}`} fontWeight="bold" color="white">
          {matchup.awayTeam.name}
        </Link>
        <Text 
          fontWeight="bold" 
          fontSize="xl"
          color={
            matchup.completed && matchup.awayScore > matchup.homeScore
              ? 'teal.200'
              : 'white'
          }
        >
          {matchup.awayScore.toFixed(1)}
        </Text>
      </Flex>
      
      {matchup.completed && (
        <Text fontSize="sm" textAlign="center" mt={3} fontWeight="medium" color="gray.300">
          {matchup.homeScore > matchup.awayScore
            ? `${matchup.homeTeam.name} wins by ${(matchup.homeScore - matchup.awayScore).toFixed(1)}`
            : `${matchup.awayTeam.name} wins by ${(matchup.awayScore - matchup.homeScore).toFixed(1)}`
          }
        </Text>
      )}
    </Box>
  );
};

const Matchups = () => {
  const { getLeague, getMatchups, calculateWeekScores, loading, error } = useApi();
  const [league, setLeague] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [matchups, setMatchups] = useState([]);
  const toast = useToast();
  
  useEffect(() => {
    const fetchLeague = async () => {
      try {
        const data = await getLeague();
        setLeague(data);
        
        // Set selected week to current week or 1 if not started
        setSelectedWeek(data.currentWeek || 1);
      } catch (error) {
        console.error('Error fetching league:', error);
      }
    };
    
    fetchLeague();
  }, [getLeague]);
  
  useEffect(() => {
    if (selectedWeek) {
      fetchMatchups(selectedWeek);
    }
  }, [selectedWeek]);
  
  const fetchMatchups = async (week) => {
    try {
      const data = await getMatchups(week);
      setMatchups(data);
    } catch (error) {
      console.error(`Error fetching matchups for week ${week}:`, error);
    }
  };
  
  const handleCalculateScores = async () => {
    try {
      const updatedMatchups = await calculateWeekScores(selectedWeek);
      
      toast({
        title: 'Scores Calculated',
        description: `Week ${selectedWeek} scores have been calculated`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setMatchups(updatedMatchups);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to calculate scores',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  if (loading && !league) {
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
        <Heading size="md" color="red.400" mb={2}>Error Loading Matchups</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  const weekOptions = league?.schedule?.length
    ? Array.from({ length: league.schedule.length }, (_, i) => i + 1)
    : [];
  
  return (
    <Box>
      <Heading mb={6} color="white">Weekly Matchups</Heading>
      
      <Flex 
        gap={4} 
        mb={6}
        align="center"
        direction={{ base: 'column', md: 'row' }}
      >
        <Select 
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
          maxW={{ base: 'full', md: '200px' }}
          bg="gray.700"
          color="white"
          borderColor="gray.600"
          _hover={{ borderColor: 'teal.400' }}
        >
          {weekOptions.map(week => (
            <option key={week} value={week} style={{ backgroundColor: '#2D3748' }}>
              Week {week}{week === league?.currentWeek ? ' (Current)' : ''}
            </option>
          ))}
        </Select>
        
        <Button 
          colorScheme="teal" 
          onClick={handleCalculateScores}
          isLoading={loading}
          isDisabled={matchups.every(m => m.completed)}
        >
          Calculate Week {selectedWeek} Scores
        </Button>
      </Flex>
      
      {matchups.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {matchups.map(matchup => (
            <MatchupCard key={matchup.id} matchup={matchup} />
          ))}
        </SimpleGrid>
      ) : (
        <Box p={6} bg="gray.800" rounded="md" textAlign="center" borderWidth={1} borderColor="gray.700">
          <Text color="gray.400">
            No matchups available for Week {selectedWeek}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default Matchups;