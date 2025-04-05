import React, { useEffect, useState, useRef } from 'react';
import { 
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  SimpleGrid, Select, Badge, Flex, Spinner, useToast, Alert, 
  AlertIcon, TabPanels, TabPanel, Tabs, TabList, Tab,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  useDisclosure, Input
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useDraftRoom } from '../context/DraftRoomContext';

const EGBDraft = () => {
  const { getPlayers, getPlayersByRegion, searchUsers, loading, error } = useApi();
  const { user } = useAuth();
  const { 
    isConnected, 
    draftState, 
    joinDraft, 
    startDraft, 
    draftPlayer,
    endDraft,
    hasUserJoined,
    isUserTurn,
    chatMessages,
    sendChatMessage
  } = useDraftRoom();
  
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [filterPosition, setFilterPosition] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  useEffect(() => {
    fetchPlayersData();
  }, []);
  
  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  useEffect(() => {
    if (filterPosition) {
      filterPlayers();
    } else {
      setFilteredPlayers(availablePlayers);
    }
  }, [filterPosition, availablePlayers]);
  
  // Filter available players based on draft history
  useEffect(() => {
    if (draftState.draftHistory && draftState.draftHistory.length > 0) {
      // Get IDs of all drafted players
      const draftedPlayerIds = draftState.draftHistory.map(pick => pick.player.id);
      
      // Filter out drafted players from available players
      const updatedAvailablePlayers = availablePlayers.filter(
        player => !draftedPlayerIds.includes(player.id)
      );
      
      setAvailablePlayers(updatedAvailablePlayers);
      
      // Update filtered players as well if no position filter is active
      if (!filterPosition) {
        setFilteredPlayers(updatedAvailablePlayers);
      } else {
        // Re-apply position filter
        const positionFiltered = updatedAvailablePlayers.filter(
          player => player.position === filterPosition
        );
        setFilteredPlayers(positionFiltered);
      }
    }
  }, [draftState.draftHistory]);
  
  const fetchPlayersData = async () => {
    setIsLoading(true);
    try {
      // Get all American players
      // Using "AMERICAS" as the region code based on the regionMappings in the backend
      const players = await getPlayersByRegion("AMERICAS");
      
      if (players && Array.isArray(players)) {
        // Set all fantasy points to 0
        const playersWithZeroPoints = players.map(player => ({
          ...player,
          fantasyPoints: 0
        }));
        
        setAvailablePlayers(playersWithZeroPoints);
        setFilteredPlayers(playersWithZeroPoints);
        console.log(`Available players: ${playersWithZeroPoints.length}`);
      } else {
        console.error('Players data is not an array:', players);
        // Fallback to getting all players if region-specific call fails
        const allPlayers = await getPlayers();
        if (allPlayers && Array.isArray(allPlayers)) {
          // Filter for American players client-side as a fallback
          const americanPlayers = allPlayers.filter(player => 
            player.region === 'AMERICAS' || 
            player.region === 'LCS' || 
            player.region === 'NA' || 
            player.region === 'NORTH' ||
            player.region === 'NORTH_AMERICA' ||
            player.homeLeague === 'AMERICAS' ||
            player.homeLeague === 'LCS' ||
            player.homeLeague === 'NA' ||
            player.homeLeague === 'NORTH' ||
            player.homeLeague === 'NORTH_AMERICA'
          ).map(player => ({
            ...player,
            fantasyPoints: 0
          }));
          
          setAvailablePlayers(americanPlayers);
          setFilteredPlayers(americanPlayers);
          console.log(`Available American players (fallback): ${americanPlayers.length}`);
        }
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      toast({
        title: 'Error Loading Data',
        description: error.message || 'Failed to load player data',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const filterPlayers = () => {
    let filtered = [...availablePlayers];
    
    if (filterPosition) {
      filtered = filtered.filter(player => player.position === filterPosition);
    }
    
    setFilteredPlayers(filtered);
  };
  
  const handleJoinDraft = () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You need to be logged in to join the draft',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    joinDraft();
    
    toast({
      title: 'Joined Draft',
      description: `You have joined the draft`,
      status: 'success',
      duration: 3000,
    });
  };
  
  const handleStartDraft = () => {
    if (draftState.participants.length < 2) {
      toast({
        title: 'Cannot Start Draft',
        description: 'Need at least 2 participants to start the draft',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    startDraft();
  };
  
  const handleEndDraft = () => {
    if (!draftState.draftStarted) {
      toast({
        title: 'Cannot End Draft',
        description: 'Draft has not started yet',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    endDraft();
    
    toast({
      title: 'Draft Ended',
      description: 'Draft has been ended and team files have been saved',
      status: 'success',
      duration: 3000,
    });
  };
  
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    sendChatMessage(chatInput);
    setChatInput('');
  };
  
  const handleDraftPlayer = (player) => {
    if (!draftState.draftStarted || draftState.draftComplete) return;
    
    if (!isUserTurn()) {
      const currentDrafter = draftState.draftOrder[draftState.currentPickIndex];
      toast({
        title: 'Not Your Turn',
        description: `It's ${currentDrafter}'s turn to draft`,
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    
    draftPlayer(player);
  };
  
  const getPositionColor = (position) => {
    switch(position) {
      case 'TOP': return 'red';
      case 'JUNGLE': return 'green';
      case 'MID': return 'purple';
      case 'ADC': return 'orange';
      case 'SUPPORT': return 'blue';
      case 'FLEX': return 'yellow';
      default: return 'gray';
    }
  };
  
  if ((loading || isLoading) && !availablePlayers.length) {
    return (
      <Flex justify="center" align="center" h="50vh" direction="column">
        <Spinner size="xl" color="yellow.400" thickness="4px" mb={4} />
        <Text color="gray.400">Loading player data...</Text>
      </Flex>
    );
  }
  
  if (error) {
    return (
      <Box p={6} bg="red.50" rounded="md" borderWidth={1} borderColor="red.200">
        <Heading size="md" color="red.500" mb={2}>Error Loading Players</Heading>
        <Text>{error}</Text>
      </Box>
    );
  }
  
  // Connection status indicator
  const ConnectionStatus = () => (
    <Flex align="center" mb={2}>
      <Box 
        w={3} 
        h={3} 
        borderRadius="full" 
        bg={isConnected ? "green.400" : "red.400"} 
        mr={2}
      />
      <Text fontSize="sm" color={isConnected ? "green.400" : "red.400"}>
        {isConnected ? "Connected to draft room" : "Disconnected from draft room"}
      </Text>
    </Flex>
  );
  
  return (
    <Box>
      <Heading mb={6} bgGradient="linear(to-r, yellow.400, orange.300)" bgClip="text">
        EGB Draft
      </Heading>
      
      <ConnectionStatus />
      
      {user ? (
        <Box mb={6} p={4} bg="blue.700" rounded="md" borderWidth={1} borderColor="blue.800">
          <Heading size="md" mb={2} color="white">
            Welcome, {user.username}!
          </Heading>
          
          {!draftState.draftStarted ? (
            <Box>
              {!hasUserJoined() ? (
                <Box mb={4}>
                  <Text mb={2} color="white">
                    Join the draft to participate and build your team.
                  </Text>
                  <Button 
                    colorScheme="yellow"
                    onClick={handleJoinDraft}
                    mb={4}
                    isDisabled={!isConnected}
                  >
                    Join Draft
                  </Button>
                </Box>
              ) : (
                <Text mb={4} color="white">
                  Add participants to the draft and click "Start Draft" to begin.
                  Only user "shark" can start the draft.
                </Text>
              )}
              
              <Text fontWeight="bold" mb={2} color="white">Current Participants:</Text>
              <Box mb={4} p={2} bg="white" borderWidth={1} borderColor="gray.200" rounded="md">
                {draftState.participants.map((participant, index) => (
                  <Badge key={index} m={1} colorScheme="yellow">
                    {participant}
                  </Badge>
                ))}
              </Box>
              
              <Flex gap={4}>
                <Button 
                  colorScheme="yellow"
                  onClick={handleStartDraft}
                  isDisabled={user.username !== 'shark' || draftState.participants.length < 2 || !isConnected}
                  isLoading={isLoading}
                >
                  Start Draft
                </Button>
                
                <Button 
                  colorScheme="red"
                  onClick={handleEndDraft}
                  isDisabled={user.username !== 'shark' || !draftState.draftStarted || !isConnected}
                  isLoading={isLoading}
                >
                  End Draft
                </Button>
              </Flex>
              
              {user.username !== 'shark' && (
                <Text fontSize="sm" color="red.300" mt={2}>
                  Only user "shark" can start or end the draft
                </Text>
              )}
            </Box>
          ) : (
            <Box>
              <Alert status={draftState.draftComplete ? "success" : "info"} mb={4}>
                <AlertIcon />
                {draftState.draftComplete ? (
                  <Text>Draft is complete! All participants have made their picks.</Text>
                ) : (
                  <Text>
                    <strong>On the clock:</strong> {draftState.draftOrder[draftState.currentPickIndex]}
                    {user.username === draftState.draftOrder[draftState.currentPickIndex] && " (You)"}
                  </Text>
                )}
              </Alert>
              
              {user.username === 'shark' && !draftState.draftComplete && (
                <Button 
                  colorScheme="red"
                  onClick={handleEndDraft}
                  isDisabled={!isConnected}
                  isLoading={isLoading}
                  mb={4}
                >
                  End Draft
                </Button>
              )}
              
              <Text color="white">
                Round: {Math.floor(draftState.draftHistory.length / draftState.draftOrder.length) + 1} • 
                Pick: {draftState.draftHistory.length + 1} •
                Total Picks: {draftState.draftHistory.length}/{draftState.draftOrder.length * 6}
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        <Alert status="warning" mb={6}>
          <AlertIcon />
          <Text>You need to be logged in to participate in the draft.</Text>
        </Alert>
      )}
      
      <Tabs variant="enclosed" colorScheme="yellow" mb={8}>
        <TabList>
          <Tab>Draft Order</Tab>
          <Tab>Draft History</Tab>
          <Tab>Teams</Tab>
          <Tab>Available Players</Tab>
          <Tab>Chat</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            {!draftState.draftStarted ? (
              <Text color="gray.500">Draft has not started yet</Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                {draftState.draftOrder.map((username, index) => (
                  <Box 
                    key={index}
                    p={4}
                    bg={index === draftState.currentPickIndex && !draftState.draftComplete ? "yellow.100" : "white"}
                    borderWidth={1}
                    borderColor="gray.200"
                    rounded="md"
                    shadow="sm"
                  >
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontWeight="bold">#{index + 1} {username}</Text>
                      {!draftState.draftComplete && index === draftState.currentPickIndex && (
                        <Badge colorScheme="green">On Clock</Badge>
                      )}
                    </Flex>
                    {username === user.username && (
                      <Badge colorScheme="blue">You</Badge>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </TabPanel>
          
          <TabPanel>
            {draftState.draftHistory.length === 0 ? (
              <Text color="gray.500">No picks have been made yet</Text>
            ) : (
              <Table variant="simple">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Round</Th>
                    <Th>Pick</Th>
                    <Th>User</Th>
                    <Th>Player</Th>
                    <Th>Position</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {draftState.draftHistory.map((pick, index) => (
                    <Tr key={index}>
                      <Td>{pick.round}</Td>
                      <Td>{pick.pick}</Td>
                      <Td>
                        <Text fontWeight="semibold">{pick.user}</Text>
                        {pick.user === user.username && (
                          <Badge colorScheme="blue" size="sm">You</Badge>
                        )}
                      </Td>
                      <Td>
                        <Text>{pick.player.name}</Text>
                        <Text fontSize="sm" color="gray.600">{pick.player.team}</Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={getPositionColor(pick.position)}>
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
            <Tabs variant="soft-rounded" colorScheme="yellow">
              <TabList mb={4} overflowX="auto" whiteSpace="nowrap" css={{ scrollbarWidth: 'thin' }}>
                {draftState.participants.map((username, index) => (
                  <Tab key={index}>
                    {username}
                    {username === user.username && " (You)"}
                  </Tab>
                ))}
              </TabList>
              
              <TabPanels>
                {draftState.participants.map((username, index) => (
                  <TabPanel key={index}>
                    <Heading size="md" mb={4}>{username}'s Team</Heading>
                    
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} mb={6}>
                      {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].map(position => (
                        <Box 
                          key={position}
                          p={4}
                          bg="white"
                          borderWidth={1}
                          borderColor="gray.200"
                          rounded="md"
                          shadow="sm"
                        >
                          <Flex justify="space-between" align="center" mb={2}>
                            <Badge colorScheme={getPositionColor(position)}>
                              {position}
                            </Badge>
                          </Flex>
                          
                          {draftState.teams[username]?.players[position] ? (
                            <Box>
                              <Text fontWeight="bold">{draftState.teams[username].players[position].name}</Text>
                              <Text fontSize="sm" color="gray.600">{draftState.teams[username].players[position].team}</Text>
                            </Box>
                          ) : (
                            <Text color="gray.500">Empty Position</Text>
                          )}
                        </Box>
                      ))}
                    </SimpleGrid>
                    
                    <Box mb={6}>
                      <Heading size="md" mb={3}>Bench</Heading>
                      {draftState.teams[username]?.players.BENCH && draftState.teams[username].players.BENCH.length > 0 ? (
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                          {draftState.teams[username].players.BENCH.map((player, idx) => (
                            <Box 
                              key={idx}
                              p={4}
                              bg="white"
                              borderWidth={1}
                              borderColor="gray.200"
                              rounded="md"
                              shadow="sm"
                            >
                              <Flex justify="space-between" align="center" mb={2}>
                                <Badge colorScheme={getPositionColor(player.position)}>
                                  {player.position}
                                </Badge>
                              </Flex>
                              <Text fontWeight="bold">{player.name}</Text>
                              <Text fontSize="sm" color="gray.600">{player.team}</Text>
                            </Box>
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Text color="gray.500">No bench players</Text>
                      )}
                    </Box>
                  </TabPanel>
                ))}
              </TabPanels>
            </Tabs>
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
              
              <Button 
                variant="outline" 
                colorScheme="yellow"
                onClick={() => {
                  setFilterPosition('');
                }}
              >
                Clear Filters
              </Button>
            </Flex>
            
            <Text mb={3}>Available players: {filteredPlayers.length}</Text>
            
            <Table variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Name</Th>
                  <Th>Position</Th>
                  <Th>Team</Th>
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
                        <Badge colorScheme={getPositionColor(player.position)}>
                          {player.position}
                        </Badge>
                      </Td>
                      <Td>{player.team}</Td>
                      <Td isNumeric>0.0</Td>
                      <Td>
                        <Button 
                          size="sm" 
                          colorScheme="yellow"
                          onClick={() => handleDraftPlayer(player)}
                          isDisabled={
                            !draftState.draftStarted || 
                            draftState.draftComplete || 
                            !isUserTurn() ||
                            !isConnected
                          }
                          isLoading={isLoading}
                        >
                          Draft
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={5} textAlign="center" py={4}>
                      <Text color="gray.500">No players available matching the filters</Text>
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TabPanel>
          
          <TabPanel>
            <Box 
              ref={chatContainerRef}
              height="400px" 
              overflowY="auto" 
              bg="gray.50" 
              p={3} 
              mb={4} 
              borderWidth={1} 
              borderColor="gray.200" 
              rounded="md"
            >
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <Box 
                    key={index} 
                    mb={2} 
                    p={2} 
                    bg={msg.username === user?.username ? "blue.100" : "white"} 
                    borderRadius="md"
                  >
                    <Flex justify="space-between" mb={1}>
                      <Text fontWeight="bold" fontSize="sm">{msg.username}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </Text>
                    </Flex>
                    <Text>{msg.message}</Text>
                  </Box>
                ))
              ) : (
                <Text color="gray.500" textAlign="center" mt={10}>No messages yet</Text>
              )}
            </Box>
            
            <form onSubmit={handleSendMessage}>
              <Flex>
                <Input
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  mr={2}
                  isDisabled={!isConnected || !user}
                />
                <Button 
                  type="submit" 
                  colorScheme="yellow"
                  isDisabled={!isConnected || !user || !chatInput.trim()}
                >
                  Send
                </Button>
              </Flex>
            </form>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default EGBDraft;
