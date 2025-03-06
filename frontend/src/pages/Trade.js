import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, Flex, Button, SimpleGrid,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Link,
  Spinner, useToast, Center, HStack, VStack,
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, ModalCloseButton, useDisclosure,
  Alert, AlertIcon, AlertTitle, AlertDescription
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const Trade = () => {
  const { id: targetTeamId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { getTeamById, getLeagueById, loading } = useApi();
  const { user } = useAuth();
  const [targetTeam, setTargetTeam] = useState(null);
  const [userTeam, setUserTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [selectedUserPlayers, setSelectedUserPlayers] = useState([]);
  const [selectedTargetPlayers, setSelectedTargetPlayers] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch the target team and the user's team in the same league
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // Fetch the target team first
        const targetTeamData = await getTeamById(targetTeamId);
        setTargetTeam(targetTeamData);

        if (!targetTeamData) {
          setError("Team not found");
          return;
        }

        // Fetch the league to get all teams
        const leagueData = await getLeagueById(targetTeamData.leagueId);
        
        if (!leagueData) {
          setError("League not found");
          return;
        }

        // Find user's team in the same league
        const userTeamsInLeague = leagueData.teams.filter(team => {
          const teamObj = typeof team === 'object' ? team : { userId: team.userId };
          return teamObj.userId === user.id;
        });

        setUserTeams(userTeamsInLeague);

        if (userTeamsInLeague.length > 0) {
          // User has a team in this league, fetch its details
          const userTeamData = await getTeamById(userTeamsInLeague[0].id);
          setUserTeam(userTeamData);
        } else {
          setError("You don't have a team in this league");
        }
      } catch (err) {
        console.error("Error fetching teams:", err);
        setError(err.message || "Failed to load teams");
      }
    };

    if (targetTeamId) {
      fetchTeams();
    }
  }, [targetTeamId, getTeamById, getLeagueById, user.id]);

  const toggleUserPlayerSelection = (player, position) => {
    const playerWithPosition = { ...player, position };
    const isSelected = selectedUserPlayers.some(p => p.id === player.id);

    if (isSelected) {
      setSelectedUserPlayers(selectedUserPlayers.filter(p => p.id !== player.id));
    } else {
      setSelectedUserPlayers([...selectedUserPlayers, playerWithPosition]);
    }
  };

  const toggleTargetPlayerSelection = (player, position) => {
    const playerWithPosition = { ...player, position };
    const isSelected = selectedTargetPlayers.some(p => p.id === player.id);

    if (isSelected) {
      setSelectedTargetPlayers(selectedTargetPlayers.filter(p => p.id !== player.id));
    } else {
      setSelectedTargetPlayers([...selectedTargetPlayers, playerWithPosition]);
    }
  };

  const isPlayerSelected = (playerId, isUserTeam) => {
    return isUserTeam
      ? selectedUserPlayers.some(p => p.id === playerId)
      : selectedTargetPlayers.some(p => p.id === playerId);
  };

  const handleProposeTrade = () => {
    if (selectedUserPlayers.length === 0 || selectedTargetPlayers.length === 0) {
      toast({
        title: 'Selection Required',
        description: 'Please select at least one player from each team',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    
    // Open confirmation modal
    onOpen();
  };

  const submitTrade = async () => {
    setIsSubmitting(true);
    
    try {
      // This would be replaced with an actual API call to submit the trade
      // await submitTradeProposal(userTeam.id, targetTeam.id, selectedUserPlayers, selectedTargetPlayers);
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Trade Proposed',
        description: 'Your trade proposal has been sent',
        status: 'success',
        duration: 5000,
      });
      
      // Navigate back to the team detail
      navigate(`/teams/${userTeam.id}`);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to propose trade',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const cancelTrade = () => {
    setSelectedUserPlayers([]);
    setSelectedTargetPlayers([]);
  };

  if (loading) {
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
        <Heading size="md" color="red.400" mb={2}>Error</Heading>
        <Text color="gray.300">{error}</Text>
        <Button 
          mt={4} 
          colorScheme="yellow" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  if (!userTeam || !targetTeam) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400">Teams Not Found</Heading>
        <Button 
          mt={4} 
          colorScheme="yellow" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  const renderPlayerRow = (position, team, isUserTeam) => {
    const player = team.players[position];
    const isSelected = player && isPlayerSelected(player.id, isUserTeam);
    
    return (
      <Tr key={`${team.id}-${position}`} _hover={{ bg: "gray.700" }}>
        <Td>
          <Badge 
            py={1} 
            px={2}
            colorScheme={
              position === 'TOP' ? 'red' :
              position === 'JUNGLE' ? 'green' :
              position === 'MID' ? 'purple' :
              position === 'ADC' ? 'orange' :
              position === 'SUPPORT' ? 'blue' :
              'gray'
            }
          >
            {position}
          </Badge>
        </Td>
        <Td>
          {player ? (
            <Link 
              as={RouterLink} 
              to={`/players/${player.id}`} 
              color={isSelected ? "green.300" : "yellow.300"} 
              fontWeight="semibold" 
              _hover={{ color: "yellow.200" }}
            >
              {player.name}
            </Link>
          ) : (
            <Text color="gray.500">Empty</Text>
          )}
        </Td>
        <Td color="white">{player ? player.fantasyPoints?.toFixed(1) || '0.0' : '-'}</Td>
        <Td>
          {player && (
            <Button 
              size="sm" 
              colorScheme={isSelected ? "green" : "yellow"}
              variant={isSelected ? "solid" : "outline"}
              onClick={() => isUserTeam 
                ? toggleUserPlayerSelection(player, position) 
                : toggleTargetPlayerSelection(player, position)
              }
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          )}
        </Td>
      </Tr>
    );
  };

  return (
    <Box>
      <Heading mb={6} color="white">Propose Trade</Heading>
      
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* User's Team */}
        <Box bg="gray.800" p={5} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <Heading size="md" mb={4} color="white">
            Your Team: {userTeam.name}
          </Heading>
          <Text color="gray.300" fontSize="lg" mb={4}>Select players to offer</Text>
          
          <Table variant="simple">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Position</Th>
                <Th color="gray.400">Player</Th>
                <Th color="gray.400">Points</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].map(position => 
                renderPlayerRow(position, userTeam, true)
              )}
            </Tbody>
          </Table>
        </Box>
        
        {/* Target Team */}
        <Box bg="gray.800" p={5} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <Heading size="md" mb={4} color="white">
            Their Team: {targetTeam.name}
          </Heading>
          <Text color="gray.300" fontSize="lg" mb={4}>Select players to receive</Text>
          
          <Table variant="simple">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Position</Th>
                <Th color="gray.400">Player</Th>
                <Th color="gray.400">Points</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].map(position => 
                renderPlayerRow(position, targetTeam, false)
              )}
            </Tbody>
          </Table>
        </Box>
      </SimpleGrid>
      
      {/* Trade Summary */}
      <Box mt={8} bg="gray.800" p={5} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
        <Heading size="md" mb={4} color="white">Trade Summary</Heading>
        
        <Flex direction={{ base: "column", md: "row" }} justify="space-between">
          <Box flex="1" mb={{ base: 4, md: 0 }}>
            <Text color="gray.300" mb={2}>You give:</Text>
            {selectedUserPlayers.length > 0 ? (
              <VStack align="flex-start" spacing={1}>
                {selectedUserPlayers.map(player => (
                  <HStack key={player.id}>
                    <Badge colorScheme="red" mr={2}>{player.position}</Badge>
                    <Text color="white">{player.name}</Text>
                    <Text color="gray.400">({player.fantasyPoints?.toFixed(1) || '0'} pts)</Text>
                  </HStack>
                ))}
              </VStack>
            ) : (
              <Text color="gray.500">No players selected</Text>
            )}
          </Box>
          
          <Box flex="1">
            <Text color="gray.300" mb={2}>You receive:</Text>
            {selectedTargetPlayers.length > 0 ? (
              <VStack align="flex-start" spacing={1}>
                {selectedTargetPlayers.map(player => (
                  <HStack key={player.id}>
                    <Badge colorScheme="green" mr={2}>{player.position}</Badge>
                    <Text color="white">{player.name}</Text>
                    <Text color="gray.400">({player.fantasyPoints?.toFixed(1) || '0'} pts)</Text>
                  </HStack>
                ))}
              </VStack>
            ) : (
              <Text color="gray.500">No players selected</Text>
            )}
          </Box>
        </Flex>
        
        {/* Points Analysis */}
        {selectedUserPlayers.length > 0 && selectedTargetPlayers.length > 0 && (
          <Box mt={6} p={4} bg="gray.700" rounded="md">
            <Heading size="sm" mb={3} color="white">Trade Analysis</Heading>
            <SimpleGrid columns={2} spacing={4}>
              <Box>
                <Text color="gray.400">Points Given:</Text>
                <Text color="white" fontWeight="bold">
                  {selectedUserPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0).toFixed(1)}
                </Text>
              </Box>
              <Box>
                <Text color="gray.400">Points Received:</Text>
                <Text color="white" fontWeight="bold">
                  {selectedTargetPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0).toFixed(1)}
                </Text>
              </Box>
            </SimpleGrid>
            
            <Box mt={4}>
              <Text color="gray.400">Net Fantasy Point Change:</Text>
              <Text 
                fontSize="lg" 
                fontWeight="bold" 
                color={
                  selectedTargetPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0) > 
                  selectedUserPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0) 
                    ? "green.400" 
                    : "red.400"
                }
              >
                {(
                  selectedTargetPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0) - 
                  selectedUserPlayers.reduce((sum, p) => sum + (p.fantasyPoints || 0), 0)
                ).toFixed(1)}
              </Text>
            </Box>
          </Box>
        )}
        
        {/* Action Buttons */}
        <HStack mt={6} spacing={4} justify="flex-end">
          <Button 
            variant="outline" 
            colorScheme="red" 
            onClick={cancelTrade}
          >
            Cancel
          </Button>
          <Button 
            colorScheme="yellow" 
            isDisabled={selectedUserPlayers.length === 0 || selectedTargetPlayers.length === 0}
            onClick={handleProposeTrade}
          >
            Propose Trade
          </Button>
        </HStack>
      </Box>
      
      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader borderBottomWidth="1px" borderColor="gray.700">
            Confirm Trade Proposal
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={6}>
            <Alert status="info" bg="blue.800" mb={4}>
              <AlertIcon />
              <AlertTitle mr={2}>Note:</AlertTitle>
              <AlertDescription>
                This trade requires approval from the other team owner.
              </AlertDescription>
            </Alert>
            
            <Text mb={4}>
              You're proposing to trade {selectedUserPlayers.length} player(s) from your team for {selectedTargetPlayers.length} player(s) from {targetTeam.name}.
            </Text>
            
            <Text fontWeight="bold">Are you sure you want to proceed?</Text>
          </ModalBody>
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button colorScheme="gray" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="yellow" 
              isLoading={isSubmitting} 
              onClick={submitTrade}
            >
              Submit Trade
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Trade;
