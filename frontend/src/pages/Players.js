import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, 
  Input, Select, Flex, Button, Badge, 
  Spinner, Text, Center, Avatar, HStack, Alert, AlertIcon,
  IconButton
} from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';

const Players = () => {
  const { getPlayers, getLeagueById } = useApi();
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load league and players
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get league data
        if (leagueId) {
          const leagueData = await getLeagueById(leagueId);
          setLeague(leagueData);
          
          // Get players from this league
          const playersData = await getPlayers(leagueId);
          setPlayers(playersData);
          setFilteredPlayers(playersData);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load players. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [leagueId, getLeagueById, getPlayers]);

  // Filter players when search/filters change
  useEffect(() => {
    if (!players.length) return;
    
    let result = [...players];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(player => 
        player.name.toLowerCase().includes(term) || 
        player.team?.toLowerCase().includes(term)
      );
    }
    
    // Apply region filter
    if (regionFilter) {
      result = result.filter(player => 
        player.region === regionFilter || player.homeLeague === regionFilter
      );
    }
    
    // Apply position filter
    if (positionFilter) {
      result = result.filter(player => player.position === positionFilter);
    }
    
    setFilteredPlayers(result);
  }, [players, searchTerm, regionFilter, positionFilter]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle region filter change
  const handleRegionChange = (e) => {
    setRegionFilter(e.target.value);
  };

  // Handle position filter change
  const handlePositionChange = (e) => {
    setPositionFilter(e.target.value);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setRegionFilter('');
    setPositionFilter('');
  };
  
  // Handle back button click
  const handleBack = () => {
    navigate('/leagues');
  };

  if (loading) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="yellow.400" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert status="error" mb={4}>
        <AlertIcon />
        <Text>{error}</Text>
      </Alert>
    );
  }

  return (
    <Box>
      <Box position="sticky" left={0} pl={0} width="100%" mt={0} zIndex={1} bg="gray.900" py={0}>
        <Flex align="center" width="100%" pl={2}>
          <IconButton
            icon={<ChevronLeftIcon boxSize={6} />}
            aria-label="Back to leagues"
            variant="ghost"
            colorScheme="yellow"
            size="lg"
            onClick={handleBack}
            mr={1}
            _hover={{ bg: 'yellow.500', color: 'white' }}
            p={1}
          />
          <Text color="gray.400" fontSize="md">Back to Leagues</Text>
        </Flex>
      </Box>
      
      <Box p={5} mt={8}>
        <Heading mb={4} bgGradient="linear(to-r, yellow.400, orange.300)" bgClip="text">
          Players
        </Heading>
        
        {league && (
          <Alert status="info" mb={4} bg="blue.800" color="white" borderRadius="md">
            <Text fontWeight="bold">League: {league.name}</Text>
          </Alert>
        )}
        
        <Box bg="gray.800" p={4} rounded="md" shadow="lg" mb={6} borderWidth={1} borderColor="gray.700">
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} mb={4}>
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={handleSearchChange}
              bg="gray.700"
              borderColor="gray.600"
              _hover={{ borderColor: 'yellow.400' }}
            />
            
            <Select 
              placeholder="Filter by region" 
              value={regionFilter}
              onChange={handleRegionChange}
              bg="gray.700"
              borderColor="gray.600"
              _hover={{ borderColor: 'yellow.400' }}
            >
              <option value="LCS">LCS</option>
              <option value="LEC">LEC</option>
              <option value="LCK">LCK</option>
              <option value="LPL">LPL</option>
            </Select>
            
            <Select 
              placeholder="Filter by position" 
              value={positionFilter}
              onChange={handlePositionChange}
              bg="gray.700"
              borderColor="gray.600"
              _hover={{ borderColor: 'yellow.400' }}
            >
              <option value="TOP">Top</option>
              <option value="JUNGLE">Jungle</option>
              <option value="MID">Mid</option>
              <option value="ADC">ADC</option>
              <option value="SUPPORT">Support</option>
              <option value="TEAM">Team</option>
            </Select>
            
            <Button 
              onClick={clearFilters} 
              colorScheme="yellow"
              _hover={{ bg: 'yellow.500' }}
            >
              Clear Filters
            </Button>
          </Flex>
        </Box>
        
        {filteredPlayers.length > 0 ? (
          <Box overflowX="auto">
            <Table variant="simple" colorScheme="whiteAlpha" bg="#1A202C" borderRadius="md" overflow="hidden">
              <Thead bg="#171923">
                <Tr>
                  <Th color="gray.300" width="30%">PLAYER</Th>
                  <Th color="gray.300" width="15%">POSITION</Th>
                  <Th color="gray.300" width="30%">TEAM</Th>
                  <Th color="gray.300" width="15%">REGION</Th>
                  <Th color="gray.300" isNumeric width="10%">FANTASY POINTS</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredPlayers.map(player => (
                  <Tr 
                    key={player.id} 
                    _hover={{ bg: '#2D3748', cursor: 'pointer' }}
                    onClick={() => navigate(`/players/${player.id}?leagueId=${leagueId}`)}
                    borderBottomWidth="1px"
                    borderColor="#2D3748"
                  >
                    <Td>
                      <HStack spacing={3}>
                        <Avatar 
                          size="sm" 
                          name={player.name}
                          src={player.imageUrl || ''}
                          bg={
                            !player.imageUrl ? (
                              player.name?.charAt(0).toLowerCase() === 'k' ? 'green.500' :
                              player.name?.charAt(0).toLowerCase() === 'c' ? 'blue.500' :
                              player.name?.charAt(0).toLowerCase() === 't' ? 'yellow.500' :
                              player.name?.charAt(0).toLowerCase() === 'h' ? 'green.300' :
                              player.name?.charAt(0).toLowerCase() === 'n' ? 'blue.300' :
                              player.name?.charAt(0).toLowerCase() === 'd' ? 'blue.700' :
                              player.name?.charAt(0).toLowerCase() === 's' ? 'teal.500' :
                              'purple.500'
                            ) : 'transparent'
                          }
                          color="white"
                          fontWeight="bold"
                          borderColor="yellow.400"
                          borderWidth="2px"
                        />
                        <Text fontWeight="medium" color="white">{player.name}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge 
                        px={2}
                        py={1}
                        borderRadius="md"
                        textTransform="uppercase"
                        fontWeight="bold"
                        fontSize="xs"
                        bg={
                          player.position === 'TOP' ? '#F56565' :
                          player.position === 'JUNGLE' ? '#48BB78' :
                          player.position === 'MID' ? '#4299E1' :
                          player.position === 'ADC' ? '#9F7AEA' :
                          player.position === 'SUPPORT' ? '#ECC94B' :
                          '#718096'
                        }
                        color="white"
                      >
                        {player.position}
                      </Badge>
                    </Td>
                    <Td color="white">{player.team}</Td>
                    <Td>
                      <Badge 
                        px={2}
                        py={1}
                        borderRadius="md"
                        textTransform="uppercase"
                        fontWeight="bold"
                        fontSize="xs"
                        bg="#4A5568"
                        color="white"
                      >
                        {player.region || player.homeLeague}
                      </Badge>
                    </Td>
                    <Td isNumeric color="white">{player.fantasyPoints?.total || 0}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        ) : (
          <Center h="200px" bg="gray.800" borderRadius="md" p={6}>
            <Text color="gray.400">
              {players.length > 0 
                ? 'No players match your filters. Try adjusting your search criteria.'
                : 'No players found for this league.'}
            </Text>
          </Center>
        )}
      </Box>
    </Box>
  );
};

export default Players;