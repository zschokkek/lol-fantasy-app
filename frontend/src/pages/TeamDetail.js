import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { 
  Box, Heading, Text, SimpleGrid, Flex, Button, IconButton,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Link,
  Spinner, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, useToast, Select, Center
} from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const TeamDetail = () => {
  const { id } = useParams();
  const { getTeamById, getPlayers, addPlayerToTeam, removePlayerFromTeam, loading, error } = useApi();
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedPosition, setSelectedPosition] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchTeam();
  }, [id]);
  
  const fetchTeam = async () => {
    try {
      const data = await getTeamById(id);
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };
  
  const handleOpenAddPlayer = (position) => {
    setSelectedPosition(position);
    // Fetch available players
    fetchAvailablePlayers(position);
    onOpen();
  };
  
  const fetchAvailablePlayers = async (position) => {
    try {
      const allPlayers = await getPlayers();
      
      // Filter by position except for FLEX which can be any position
      let filteredPlayers = position === 'FLEX' 
        ? allPlayers 
        : allPlayers.filter(p => p.position === position);
      
      // Filter out players already on this team
      const teamPlayerIds = Object.values(team.players)
        .filter(p => p !== null)
        .map(p => typeof p === 'object' ? p.id : p);
      
      filteredPlayers = filteredPlayers.filter(p => !teamPlayerIds.includes(p.id));
      
      setAvailablePlayers(filteredPlayers);
    } catch (error) {
      console.error('Error fetching available players:', error);
      setAvailablePlayers([]);
    }
  };
  
  const handleAddPlayer = async (playerId) => {
    try {
      await addPlayerToTeam(team.id, playerId, selectedPosition);
      
      toast({
        title: 'Player Added',
        description: 'Player has been added to your team',
        status: 'success',
        duration: 3000,
      });
      
      // Refresh team data
      fetchTeam();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add player',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  const handleRemovePlayer = async (playerId) => {
    try {
      await removePlayerFromTeam(team.id, playerId);
      
      toast({
        title: 'Player Removed',
        description: 'Player has been removed from your team',
        status: 'success',
        duration: 3000,
      });
      
      // Refresh team data
      fetchTeam();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove player',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  // Handle back button click
  const handleBack = () => {
    // Navigate to the league detail page if team has a leagueId
    if (team && team.leagueId) {
      navigate(`/leagues/${team.leagueId}`);
    } else {
      // Otherwise go to leagues list
      navigate('/leagues');
    }
  };
  
  if (loading && !team) {
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
        <Heading size="md" color="red.400" mb={2}>Error Loading Team</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  if (!team) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400">Team Not Found</Heading>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex mb={4} align="center" justifyContent="flex-start" width="100%">
        <IconButton
          icon={<ChevronLeftIcon boxSize={6} />}
          aria-label="Back to league"
          variant="ghost"
          colorScheme="yellow"
          size="lg"
          onClick={handleBack}
          mr={2}
          _hover={{ bg: 'yellow.500', color: 'white' }}
          marginLeft={0}
        />
        <Text color="gray.400" fontSize="md">Back to League</Text>
      </Flex>
      
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading color="white">{team.name}</Heading>
          <Text color="gray.300" fontSize="lg">Owner: {team.owner}</Text>
        </Box>
        <Flex align="center" gap={4}>
          {/* Only show trade button if this is not the user's team */}
          {team.userId !== (user?.id) && (
            <Button
              as={RouterLink}
              to={`/trade/${team.id}`}
              colorScheme="yellow"
              leftIcon={<Box as="span" fontSize="lg">↔</Box>}
              size="sm"
            >
              Propose Trade
            </Button>
          )}
          <Box>
            <Text fontWeight="bold" fontSize="xl" color="yellow.300">
              {team.totalPoints?.toFixed(1) || 0} pts
            </Text>
          </Box>
        </Flex>
      </Flex>
      
      <Box bg="gray.800" p={5} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
        <Heading size="md" mb={4} color="white">Active Roster</Heading>
        
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
            {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].map(position => {
              const player = team.players[position];
              
              return (
                <Tr key={position} _hover={{ bg: "gray.700" }}>
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
                      <Link as={RouterLink} to={`/players/${player.id}`} color="yellow.300" fontWeight="semibold" _hover={{ color: "yellow.200" }}>
                        {player.name}
                      </Link>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        colorScheme="yellow"
                        onClick={() => handleOpenAddPlayer(position)}
                      >
                        Add Player
                      </Button>
                    )}
                  </Td>
                  <Td color="white">{player ? player.fantasyPoints.toFixed(1) : '-'}</Td>
                  <Td>
                    {player && (
                      <Button 
                        size="sm" 
                        colorScheme="red" 
                        variant="ghost"
                        _hover={{ bg: "rgba(255, 69, 58, 0.15)" }}
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>
      
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent bg="gray.800" color="white" borderRadius="lg">
          <ModalHeader borderBottomWidth="1px" borderColor="gray.700">
            Add Player to {selectedPosition}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {availablePlayers.length > 0 ? (
              <Table variant="simple">
                <Thead bg="gray.900">
                  <Tr>
                    <Th color="gray.400">Name</Th>
                    <Th color="gray.400">Position</Th>
                    <Th color="gray.400">Points</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {availablePlayers.map(player => (
                    <Tr key={player.id} _hover={{ bg: "gray.700" }}>
                      <Td>
                        <Text fontWeight="semibold" color="white">{player.name}</Text>
                        <Text fontSize="sm" color="gray.400">{player.team}</Text>
                      </Td>
                      <Td>
                        <Badge 
                          colorScheme={
                            player.position === 'TOP' ? 'red' :
                            player.position === 'JUNGLE' ? 'green' :
                            player.position === 'MID' ? 'purple' :
                            player.position === 'ADC' ? 'orange' :
                            'blue'
                          }
                        >
                          {player.position}
                        </Badge>
                      </Td>
                      <Td color="white">{player.fantasyPoints.toFixed(1)}</Td>
                      <Td>
                        <Button 
                          size="sm" 
                          colorScheme="yellow"
                          onClick={() => handleAddPlayer(player.id)}
                        >
                          Add
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Text color="gray.400" textAlign="center" py={4}>
                No available players for this position
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TeamDetail;