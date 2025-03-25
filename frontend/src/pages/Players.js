import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, Navigate, useParams } from 'react-router-dom';
import { 
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, 
  Link, Input, Select, Flex, Button, Badge, 
  Spinner, Text, Center, Avatar, HStack, Alert, AlertIcon
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import { useLeague } from '../context/LeagueContext';

const Players = () => {
  const { getPlayers, getLeagueById, loading, error } = useApi();
  const { selectedLeague, setSelectedLeague } = useLeague();
  const location = useLocation();
  const { leagueId } = useParams(); // Get leagueId from URL if available
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [showLeagueAlert, setShowLeagueAlert] = useState(false);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [leagueLoadError, setLeagueLoadError] = useState(false);
  
  // First priority: Handle league ID from URL if present
  useEffect(() => {
    if (leagueId) {
      // Log the extracted leagueId for debugging
      console.log('Players.js: Extracted leagueId from URL:', leagueId);
      
      setLoadingLeague(true);
      getLeagueById(leagueId)
        .then(league => {
          // Log the response from getLeagueById
          console.log('Players.js: Response from getLeagueById:', league);
          
          if (league) {
            setSelectedLeague(league);
            // If the league has regions, set the filter to the first region
            if (league.regions && league.regions.length > 0) {
              setLeagueFilter(league.regions[0]);
            }
            setShowLeagueAlert(false);
            setLeagueLoadError(false);
          } else {
            console.error('League not found with ID:', leagueId);
            setLeagueLoadError(true);
          }
        })
        .catch(err => {
          console.error('Error loading league from URL parameter:', err);
          setLeagueLoadError(true);
        })
        .finally(() => {
          setLoadingLeague(false);
        });
    } else if (!selectedLeague && location.state?.requireLeague) {
      // Only show alert if we don't have a league ID in URL and no selected league
      setShowLeagueAlert(true);
    }
  }, [leagueId, selectedLeague, getLeagueById, setSelectedLeague, location.state]);
  
  // If coming from LeagueDetail with a selectedLeague, set filters
  useEffect(() => {
    if (selectedLeague && location.state?.fromLeagueDetail) {
      // If we're coming from LeagueDetail, pre-filter by the league's regions
      if (selectedLeague.regions && selectedLeague.regions.length > 0) {
        // Set initial league filter based on the first region of the selected league
        setLeagueFilter(selectedLeague.regions[0]);
      }
    }
  }, [selectedLeague, location.state]);
  
  // Load players when component mounts
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const data = await getPlayers();
        setPlayers(data);
        setFilteredPlayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };
    
    fetchPlayers();
  }, [getPlayers]);
  
  // Filter players based on search criteria
  useEffect(() => {
    let result = players;
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply league filter
    if (leagueFilter) {
      result = result.filter(player => player.homeLeague === leagueFilter);
    }
    
    // Apply position filter
    if (positionFilter) {
      result = result.filter(player => player.position === positionFilter);
    }
    
    setFilteredPlayers(result);
  }, [searchTerm, leagueFilter, positionFilter, players]);
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setLeagueFilter('');
    setPositionFilter('');
  };
  
  // For league selection error or missing league, show a navigate option
  // IMPORTANT: Only redirect if we don't have a leagueId in the URL AND we're missing a selected league
  if (showLeagueAlert && !selectedLeague && !leagueId && !loadingLeague) {
    return <Navigate to="/leagues" state={{ returnTo: location.pathname }} replace />;
  }
  
  // Show loading spinner while fetching data
  if ((loading && players.length === 0) || loadingLeague) {
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
  
  // Handle league load error
  if (leagueLoadError) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="red.500">
        <Heading size="md" color="red.400" mb={2}>League Not Found</Heading>
        <Text color="gray.300">The specified league could not be found.</Text>
        <Button 
          as={RouterLink} 
          to="/leagues" 
          colorScheme="teal" 
          mt={4}
        >
          Go to Leagues
        </Button>
      </Box>
    );
  }
  
  // Handle API error
  if (error) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="red.500">
        <Heading size="md" color="red.400" mb={2}>Error Loading Players</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Heading mb={6} color="white">Players</Heading>
      
      {selectedLeague && (
        <Alert status="info" mb={4} bg="blue.800" color="white" borderRadius="md">
          <AlertIcon color="blue.200" />
          Viewing players for league: {selectedLeague.name}
        </Alert>
      )}
      
      <Box bg="gray.800" p={4} rounded="md" shadow="lg" mb={6} borderWidth={1} borderColor="gray.700">
        <Flex direction={{ base: 'column', md: 'row' }} gap={4} mb={4}>
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            bg="gray.700"
            borderColor="gray.600"
            color="white"
            _hover={{ borderColor: "teal.300" }}
            _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
          />
          
          <Select 
            placeholder="All Leagues" 
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            bg="gray.700"
            borderColor="gray.600"
            color="white"
            _hover={{ borderColor: "teal.300" }}
            _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
          >
            <option value="LTA North">LTA North</option>
            <option value="LTA South">LTA South</option>
            <option value="LEC">LEC</option>
            <option value="LCK">LCK</option>
            <option value="LPL">LPL</option>
          </Select>
          
          <Select 
            placeholder="All Positions" 
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            bg="gray.700"
            borderColor="gray.600"
            color="white"
            _hover={{ borderColor: "teal.300" }}
            _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
          >
            <option value="TOP">Top</option>
            <option value="JUNGLE">Jungle</option>
            <option value="MID">Mid</option>
            <option value="ADC">ADC</option>
            <option value="SUPPORT">Support</option>
          </Select>
          
          <Button 
            onClick={handleClearFilters} 
            variant="outline" 
            borderColor="gray.600" 
            color="gray.300"
            _hover={{ bg: "whiteAlpha.100", borderColor: "teal.300" }}
          >
            Clear Filters
          </Button>
        </Flex>
      </Box>
      
      <Box bg="gray.800" rounded="md" shadow="lg" overflowX="auto" borderWidth={1} borderColor="gray.700">
        <Table variant="simple">
          <Thead bg="gray.900">
            <Tr>
              <Th color="gray.400">Name</Th>
              <Th color="gray.400">Position</Th>
              <Th color="gray.400">Team</Th>
              <Th color="gray.400">League</Th>
              <Th isNumeric color="gray.400">Fantasy Points</Th>
              <Th isNumeric color="gray.400">KDA</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredPlayers.map(player => {
              const kda = player.stats && player.stats.deaths > 0 
                ? ((player.stats.kills + player.stats.assists) / player.stats.deaths).toFixed(2)
                : 'Perfect';
              
              return (
                <Tr key={player.id} _hover={{ bg: "gray.700" }}>
                  <Td>
                    <HStack spacing={2}>
                      <Avatar 
                        size="sm" 
                        name={player.name} 
                        src={player.imageUrl} 
                        bg="gray.600"
                        color="white"
                      />
                      <Link as={RouterLink} to={`/players/${player.id}`} color="yellow.400" fontWeight="semibold" _hover={{ color: "yellow.300" }}>
                        {player.name}
                      </Link>
                    </HStack>
                  </Td>
                  <Td>
                    <Badge colorScheme={
                      player.position === 'TOP' ? 'blue' :
                      player.position === 'JUNGLE' ? 'green' :
                      player.position === 'MID' ? 'purple' :
                      player.position === 'ADC' ? 'orange' :
                      player.position === 'SUPPORT' ? 'pink' :
                      'red'
                    }>
                      {player.position}
                    </Badge>
                  </Td>
                  <Td color="white">{player.team}</Td>
                  <Td>
                    <Badge colorScheme={
                      player.homeLeague === 'LCK' ? 'red' : 
                      player.homeLeague === 'LEC' ? 'blue' : 
                      player.homeLeague === 'LPL' ? 'yellow' : 
                      player.homeLeague === 'LTA North' ? 'green' : 
                      player.homeLeague === 'LTA South' ? 'purple' : 'gray'
                    }>
                      {player.homeLeague || player.region}
                    </Badge>
                  </Td>
                  <Td isNumeric fontWeight="bold" color="teal.300">{player.fantasyPoints.toFixed(1)}</Td>
                  <Td isNumeric color="white">{kda}</Td>
                </Tr>
              );
            })}
            
            {filteredPlayers.length === 0 && (
              <Tr>
                <Td colSpan={6} textAlign="center" py={4}>
                  <Text color="gray.400">No players found matching the filters</Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
};

export default Players;