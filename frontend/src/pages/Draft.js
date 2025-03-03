import React, { useEffect, useState } from 'react';
import { 
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  SimpleGrid, Select, Badge, Flex, Spinner, useToast, Alert, 
  AlertIcon, AlertTitle, AlertDescription, Tabs, TabList, Tab,
  TabPanels, TabPanel, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, useDisclosure
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useApi } from '../context/ApiContext';

const Draft = () => {
  // Use getPlayers directly since getDraftStatus might not be implemented yet
  const { getLeague, getPlayers, addPlayerToTeam, loading, error } = useApi();
  const [league, setLeague] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [draftStarted, setDraftStarted] = useState(false);
  const [draftComplete, setDraftComplete] = useState(false);
  const [draftHistory, setDraftHistory] = useState([]);
  const [filterPosition, setFilterPosition] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  
  useEffect(() => {
    fetchLeagueData();
  }, []);
  
  useEffect(() => {
    if (filterPosition || filterRegion) {
      filterPlayers();
    } else {
      setFilteredPlayers(availablePlayers);
    }
  }, [filterPosition, filterRegion, availablePlayers]);
  
  const fetchLeagueData = async () => {
    setIsLoading(true);
    try {
      // Get league data
      const leagueData = await getLeague();
      setLeague(leagueData);
      
      // Check if draft has enough teams
      const hasEnoughTeams = leagueData.teams.length >= 8;
      
      if (hasEnoughTeams) {
        // Generate draft order if not already set
        if (draftOrder.length === 0) {
          // Use stored draft order or generate new one
          const storedOrder = localStorage.getItem('draftOrder');
          if (storedOrder) {
            try {
              const parsedOrder = JSON.parse(storedOrder);
              // Validate stored order contains valid teams
              const isValidOrder = parsedOrder.every(teamId => 
                leagueData.teams.some(team => team.id === teamId)
              );
              
              if (isValidOrder) {
                const orderedTeams = parsedOrder.map(teamId => 
                  leagueData.teams.find(team => team.id === teamId)
                );
                setDraftOrder(orderedTeams);
              } else {
                generateNewDraftOrder(leagueData.teams);
              }
            } catch {
              generateNewDraftOrder(leagueData.teams);
            }
          } else {
            generateNewDraftOrder(leagueData.teams);
          }
        }
        
        // If history exists in local storage, load it
        const storedHistory = localStorage.getItem('draftHistory');
        if (storedHistory) {
          try {
            const parsedHistory = JSON.parse(storedHistory);
            if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
              setDraftHistory(parsedHistory);
              setDraftStarted(true);
              
              // Set current team index based on history length
              if (parsedHistory.length > 0 && leagueData.teams.length > 0) {
                const roundCount = Math.floor(parsedHistory.length / leagueData.teams.length);
                const isEvenRound = roundCount % 2 === 1;
                const pickInRound = parsedHistory.length % leagueData.teams.length;
                
                let nextIndex;
                if (isEvenRound) {
                  // Even rounds go in reverse
                  nextIndex = leagueData.teams.length - 1 - pickInRound;
                } else {
                  // Odd rounds go in order
                  nextIndex = pickInRound;
                }
                
                if (nextIndex >= 0 && nextIndex < leagueData.teams.length) {
                  setCurrentTeamIndex(nextIndex);
                }
                
                // Check if draft is complete
                const totalPicks = leagueData.teams.length * 6; // 6 picks per team
                if (parsedHistory.length >= totalPicks) {
                  setDraftComplete(true);
                }
              }
            }
          } catch {
            // If error parsing, just start fresh
            setDraftHistory([]);
          }
        }
      }
      
      // Get all players - important to do this regardless of draft status
      const players = await getPlayers();
      
      if (players && Array.isArray(players)) {
        // Filter out players who are already on teams
        const draftedPlayerIds = new Set();
        
        if (leagueData && leagueData.teams) {
          leagueData.teams.forEach(team => {
            // Check main positions
            ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].forEach(pos => {
              if (team.players[pos]) {
                draftedPlayerIds.add(team.players[pos].id);
              }
            });
            
            // Check bench
            if (team.players.BENCH) {
              team.players.BENCH.forEach(player => {
                draftedPlayerIds.add(player.id);
              });
            }
          });
        }
        
        // Set available players as those not already drafted
        const availablePlayers = players.filter(player => !draftedPlayerIds.has(player.id));
        setAvailablePlayers(availablePlayers);
        setFilteredPlayers(availablePlayers);
        
        console.log(`Available players: ${availablePlayers.length}`);
      } else {
        console.error('Players data is not an array:', players);
      }
    } catch (error) {
      console.error('Error fetching draft data:', error);
      toast({
        title: 'Error Loading Data',
        description: error.message || 'Failed to load draft data',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateNewDraftOrder = (teams) => {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    setDraftOrder(shuffledTeams);
    
    // Store draft order in local storage for persistence
    const teamIds = shuffledTeams.map(team => team.id);
    localStorage.setItem('draftOrder', JSON.stringify(teamIds));
  };
  
  const filterPlayers = () => {
    let filtered = [...availablePlayers];
    
    if (filterPosition) {
      filtered = filtered.filter(player => player.position === filterPosition);
    }
    
    if (filterRegion) {
      filtered = filtered.filter(player => player.region === filterRegion);
    }
    
    setFilteredPlayers(filtered);
  };
  
  const startDraft = () => {
    if (draftOrder.length < 8) {
      toast({
        title: 'Cannot Start Draft',
        description: 'Need at least 8 teams to start the draft',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    setDraftStarted(true);
    setCurrentTeamIndex(0);
    setDraftHistory([]);
    
    // Clear local storage history since we're starting fresh
    localStorage.removeItem('draftHistory');
    
    toast({
      title: 'Draft Started',
      description: `${draftOrder[0].name} is on the clock!`,
      status: 'success',
      duration: 3000,
    });
  };
  
  const openTeamDraft = (team) => {
    setSelectedTeam(team);
    onOpen();
  };
  
  const handleDraftPlayer = async (player) => {
    if (!draftStarted || draftComplete) return;
    
    const currentTeam = draftOrder[currentTeamIndex];
    setIsLoading(true);
    
    try {
      // Determine best position for player
      let positionToFill = '';
      
      // Try to place in primary position first
      if (!currentTeam.players[player.position]) {
        positionToFill = player.position;
      } 
      // Try FLEX position
      else if (!currentTeam.players.FLEX) {
        positionToFill = 'FLEX';
      }
      // Try bench
      else if (!currentTeam.players.BENCH || currentTeam.players.BENCH.length < 3) {
        positionToFill = 'BENCH';
      } else {
        toast({
          title: 'Position Error',
          description: 'No valid position available for this player',
          status: 'error',
          duration: 3000,
        });
        setIsLoading(false);
        return;
      }
      
      // Add player to team
      await addPlayerToTeam(currentTeam.id, player.id, positionToFill);
      
      // Add to draft history
      const draftPick = {
        round: Math.floor(draftHistory.length / draftOrder.length) + 1,
        pick: draftHistory.length + 1,
        team: currentTeam,
        player: player,
        position: positionToFill
      };
      
      const updatedHistory = [...draftHistory, draftPick];
      setDraftHistory(updatedHistory);
      
      // Store history in local storage for persistence
      localStorage.setItem('draftHistory', JSON.stringify(updatedHistory));
      
      // Remove player from available players
      setAvailablePlayers(availablePlayers.filter(p => p.id !== player.id));
      setFilteredPlayers(filteredPlayers.filter(p => p.id !== player.id));
      
      // Calculate next team index for snake draft
      const nextIndex = calculateNextTeamIndex(currentTeamIndex, draftOrder.length, updatedHistory.length);
      setCurrentTeamIndex(nextIndex);
      
      // Check if draft is complete
      const totalRosterSpots = draftOrder.length * 6; // 6 players per team (5 starters + 1 flex)
      if (updatedHistory.length >= totalRosterSpots) {
        setDraftComplete(true);
        toast({
          title: 'Draft Complete',
          description: 'All teams have completed their draft picks',
          status: 'success',
          duration: 5000,
        });
      } else {
        toast({
          title: 'Pick Successful',
          description: `${draftOrder[nextIndex].name} is now on the clock!`,
          status: 'success',
          duration: 3000,
        });
      }
      
      // Refresh league data to get updated team roster
      await fetchLeagueData();
      
      // Close modal if open
      onClose();
    } catch (error) {
      toast({
        title: 'Draft Error',
        description: error.message || 'Failed to draft player',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to calculate next team index in snake draft
  const calculateNextTeamIndex = (currentIndex, totalTeams, historyLength) => {
    const roundNumber = Math.floor(historyLength / totalTeams);
    const isEvenRound = roundNumber % 2 === 1; // 0-indexed round numbers, so odd number = even round
    
    if (isEvenRound) {
      // Even rounds go backward
      if (currentIndex > 0) {
        return currentIndex - 1;
      } else {
        // Reached the beginning, start next round
        return 0;
      }
    } else {
      // Odd rounds go forward
      if (currentIndex < totalTeams - 1) {
        return currentIndex + 1;
      } else {
        // Reached the end, start going backward
        return totalTeams - 1;
      }
    }
  };
  
  if ((loading || isLoading) && !league && !availablePlayers.length) {
    return <Spinner size="xl" />;
  }
  
  if (error) {
    return (
      <Box p={6} bg="red.50" rounded="md" borderWidth={1} borderColor="red.200">
        <Heading size="md" color="red.500" mb={2}>Error Loading Draft</Heading>
        <Text>{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Heading mb={6}>Player Draft</Heading>
      
      {league && league.teams.length < 8 ? (
        <Alert status="warning" mb={6}>
          <AlertIcon />
          <AlertTitle>Draft Not Available</AlertTitle>
          <AlertDescription>
            You need at least 8 teams to start a draft. Currently have {league.teams.length} teams.
            <Button ml={4} as={RouterLink} to="/teams" size="sm" colorScheme="blue">
              Create Teams
            </Button>
          </AlertDescription>
        </Alert>
      ) : !draftStarted ? (
        <Box mb={6} p={6} bg="blue.50" rounded="md">
          <Heading size="md" mb={4}>Ready to Start Draft</Heading>
          <Text mb={4}>
            You have {league?.teams.length} teams ready to draft. The draft order will be randomized.
          </Text>
          <Button colorScheme="blue" onClick={startDraft} isLoading={isLoading}>
            Start Draft
          </Button>
        </Box>
      ) : (
        <Box mb={6} p={4} bg={draftComplete ? "green.50" : "yellow.50"} rounded="md">
          <Heading size="md" mb={2}>
            {draftComplete ? 'Draft Complete' : 'Draft In Progress'}
          </Heading>
          {!draftComplete && draftOrder.length > 0 && (
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Text fontWeight="bold">On the clock: {draftOrder[currentTeamIndex]?.name}</Text>
            </Alert>
          )}
          <Text>
            Round: {Math.floor(draftHistory.length / (draftOrder.length || 1)) + 1} • 
            Pick: {draftHistory.length + 1} •
            Total Picks: {draftHistory.length}/{(draftOrder.length || 0) * 6}
          </Text>
        </Box>
      )}
      
      <Tabs variant="enclosed" colorScheme="blue" mb={8}>
        <TabList>
          <Tab>Draft Order</Tab>
          <Tab>Draft History</Tab>
          <Tab>Available Players</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              {draftOrder.map((team, index) => (
                <Box 
                  key={team.id}
                  p={4}
                  bg={index === currentTeamIndex && draftStarted && !draftComplete ? "yellow.100" : "white"}
                  borderWidth={1}
                  borderColor="gray.200"
                  rounded="md"
                  shadow="sm"
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontWeight="bold">#{index + 1} {team.name}</Text>
                    {draftStarted && !draftComplete && index === currentTeamIndex && (
                      <Badge colorScheme="green">On Clock</Badge>
                    )}
                  </Flex>
                  <Text fontSize="sm" color="gray.600">Owner: {team.owner}</Text>
                  
                  {draftStarted && (
                    <Button 
                      mt={3} 
                      size="sm" 
                      width="full"
                      colorScheme="blue"
                      isDisabled={index !== currentTeamIndex || draftComplete || isLoading}
                      onClick={() => openTeamDraft(team)}
                      isLoading={index === currentTeamIndex && isLoading}
                    >
                      Make Pick
                    </Button>
                  )}
                </Box>
              ))}
            </SimpleGrid>
          </TabPanel>
          
          <TabPanel>
            {draftHistory.length === 0 ? (
              <Text color="gray.500">No picks have been made yet</Text>
            ) : (
              <Table variant="simple">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Round</Th>
                    <Th>Pick</Th>
                    <Th>Team</Th>
                    <Th>Player</Th>
                    <Th>Position</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {draftHistory.map((pick, index) => (
                    <Tr key={index}>
                      <Td>{pick.round}</Td>
                      <Td>{pick.pick}</Td>
                      <Td>
                        <Text fontWeight="semibold">{pick.team.name}</Text>
                      </Td>
                      <Td>
                        <Text>{pick.player.name}</Text>
                        <Text fontSize="sm" color="gray.600">{pick.player.team}</Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={
                          pick.position === 'TOP' ? 'red' :
                          pick.position === 'JUNGLE' ? 'green' :
                          pick.position === 'MID' ? 'purple' :
                          pick.position === 'ADC' ? 'orange' :
                          pick.position === 'SUPPORT' ? 'blue' :
                          pick.position === 'FLEX' ? 'teal' :
                          'gray'
                        }>
                          {pick.position}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>
          
          <TabPanel>
            <Flex mb={4} gap={4}>
              <Select 
                placeholder="Filter by Position" 
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                maxW={200}
              >
                <option value="TOP">Top</option>
                <option value="JUNGLE">Jungle</option>
                <option value="MID">Mid</option>
                <option value="ADC">ADC</option>
                <option value="SUPPORT">Support</option>
              </Select>
              
              <Select 
                placeholder="Filter by Region" 
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                maxW={200}
              >
                <option value="NORTH">North</option>
                <option value="SOUTH">South</option>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilterPosition('');
                  setFilterRegion('');
                }}
              >
                Clear Filters
              </Button>
            </Flex>
            
            {/* Add player count info */}
            <Text mb={3}>Available players: {filteredPlayers.length}</Text>
            
            <Table variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Name</Th>
                  <Th>Position</Th>
                  <Th>Team</Th>
                  <Th>Region</Th>
                  <Th isNumeric>Fantasy Points</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {Array.isArray(filteredPlayers) && filteredPlayers.length > 0 ? (
                  filteredPlayers.map(player => (
                    <Tr key={player.id}>
                      <Td>{player.name}</Td>
                      <Td>
                        <Badge colorScheme={
                          player.position === 'TOP' ? 'red' :
                          player.position === 'JUNGLE' ? 'green' :
                          player.position === 'MID' ? 'purple' :
                          player.position === 'ADC' ? 'orange' :
                          'blue'
                        }>
                          {player.position}
                        </Badge>
                      </Td>
                      <Td>{player.team}</Td>
                      <Td>
                        <Badge colorScheme={player.region === 'NORTH' ? 'cyan' : 'yellow'}>
                          {player.region}
                        </Badge>
                      </Td>
                      <Td isNumeric>{player.fantasyPoints?.toFixed(1) || '0.0'}</Td>
                      <Td>
                        <Button 
                          size="sm" 
                          colorScheme="blue"
                          isDisabled={!draftStarted || draftComplete || currentTeamIndex === -1 || isLoading}
                          onClick={() => handleDraftPlayer(player)}
                          isLoading={isLoading}
                        >
                          Draft
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={4}>
                      <Text color="gray.500">No players available matching the filters</Text>
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TabPanel>
        </TabPanels>
      </Tabs>
      
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Make Pick for {selectedTeam?.name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex mb={4} gap={4}>
              <Select 
                placeholder="Filter by Position" 
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
              >
                <option value="TOP">Top</option>
                <option value="JUNGLE">Jungle</option>
                <option value="MID">Mid</option>
                <option value="ADC">ADC</option>
                <option value="SUPPORT">Support</option>
              </Select>
              
              <Select 
                placeholder="Filter by Region" 
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
              >
                <option value="NORTH">North</option>
                <option value="SOUTH">South</option>
              </Select>
            </Flex>
            
            <Text mb={3}>Available players: {filteredPlayers.length}</Text>
            
            <Table size="sm" variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Name</Th>
                  <Th>Position</Th>
                  <Th>Team</Th>
                  <Th isNumeric>Points</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredPlayers.slice(0, 10).map(player => (
                  <Tr key={player.id}>
                    <Td>{player.name}</Td>
                    <Td>
                      <Badge colorScheme={
                        player.position === 'TOP' ? 'red' :
                        player.position === 'JUNGLE' ? 'green' :
                        player.position === 'MID' ? 'purple' :
                        player.position === 'ADC' ? 'orange' :
                        'blue'
                      }>
                        {player.position}
                      </Badge>
                    </Td>
                    <Td>{player.team}</Td>
                    <Td isNumeric>{player.fantasyPoints?.toFixed(1) || '0.0'}</Td>
                    <Td>
                      <Button 
                        size="sm" 
                        colorScheme="blue"
                        onClick={() => handleDraftPlayer(player)}
                        isLoading={isLoading}
                      >
                        Draft
                      </Button>
                    </Td>
                  </Tr>
                ))}
                
                {filteredPlayers.length === 0 && (
                  <Tr>
                    <Td colSpan={5} textAlign="center" py={4}>
                      <Text color="gray.500">No players available matching the filters</Text>
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Draft;