import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, SimpleGrid, Text, Flex, Link, 
  Badge, Select, Button, Spinner, useToast,
  Center, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, ModalFooter, useDisclosure
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import MatchupDetails from '../components/MatchupDetails';

const MatchupCard = ({ matchup, onClick }) => {
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
      _hover={{ transform: 'translateY(-2px)', borderColor: 'yellow.400' }}
      onClick={onClick}
      cursor="pointer"
    >
      {matchup.completed && (
        <Badge 
          position="absolute" 
          top={2} 
          right={2} 
          colorScheme="yellow"
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
            ? 'yellow.900'
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
              ? 'yellow.200'
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
            ? 'yellow.900'
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
              ? 'yellow.200'
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
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  useEffect(() => {
    const fetchLeague = async () => {
      try {
        const data = await getLeague(); // Update the API endpoint here
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
    if (league) {
      fetchMatchups(league.id, selectedWeek);
    }
  }, [selectedWeek, league]);
  
  const fetchMatchups = async (leagueId, week) => {
    try {
      const data = await getMatchups(week, leagueId);
      setMatchups(data);
    } catch (error) {
      console.error(`Error fetching matchups for week ${week}:`, error);
    }
  };
  
  const handleCalculateScores = async () => {
    try {
      const updatedMatchups = await calculateWeekScores(league.id, selectedWeek);
      
      toast({
        title: 'Scores Calculated',
        description: 'Week scores have been calculated successfully',
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
          color="yellow.400"
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
      <Heading mb={6} color="white" bgGradient="linear(to-r, yellow.400, orange.300)" bgClip="text">Weekly Matchups</Heading>
      
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
          _hover={{ borderColor: 'yellow.400' }}
        >
          {weekOptions.map(week => (
            <option key={week} value={week} style={{ backgroundColor: '#2D3748' }}>
              Week {week}{week === league?.currentWeek ? ' (Current)' : ''}
            </option>
          ))}
        </Select>
        
        <Button 
          colorScheme="yellow" 
          onClick={handleCalculateScores}
          isLoading={loading}
          isDisabled={matchups.every(m => m.completed)}
          _hover={{ bg: 'yellow.500' }}
        >
          Calculate Week {selectedWeek} Scores
        </Button>
      </Flex>
      
      {matchups.length > 0 ? (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {matchups.map(matchup => (
              <MatchupCard 
                key={matchup.id} 
                matchup={matchup} 
                onClick={() => {
                  setSelectedMatchup(matchup);
                  onOpen();
                }}
              />
            ))}
          </SimpleGrid>
          
          {/* Matchup Details Modal */}
          <Modal isOpen={isOpen} onClose={onClose} size="4xl">
            <ModalOverlay backgroundColor="rgba(0, 0, 0, 0.75)" />
            <ModalContent bg="gray.900" borderColor="yellow.400" borderWidth={1}>
              <ModalHeader>
                <Text bgGradient="linear(to-r, yellow.400, orange.300)" bgClip="text">
                  Detailed Matchup
                </Text>
              </ModalHeader>
              <ModalCloseButton color="gray.400" />
              <ModalBody pb={6}>
                {selectedMatchup && (
                  <MatchupDetails matchup={selectedMatchup} />
                )}
              </ModalBody>
              <ModalFooter>
                <Button 
                  onClick={onClose} 
                  variant="outline" 
                  borderColor="yellow.400" 
                  color="white"
                  _hover={{ bg: 'yellow.800' }}
                >
                  Close
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </>
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