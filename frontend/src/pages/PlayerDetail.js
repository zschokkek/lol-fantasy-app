import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, Heading, Text, Stat, StatLabel, StatNumber, StatHelpText,
  SimpleGrid, Badge, Button, Flex, Divider, Progress,
  Spinner, useToast, Center, Avatar, InputGroup, Input, 
  InputRightElement, VStack, HStack
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';

const PlayerDetail = () => {
  const { id } = useParams();
  const { getPlayerById, updatePlayerStats, updatePlayerImage, loading, error } = useApi();
  const [player, setPlayer] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const toast = useToast();
  
  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const data = await getPlayerById(id);
        setPlayer(data);
      } catch (error) {
        console.error('Error fetching player:', error);
      }
    };
    
    fetchPlayer();
  }, [getPlayerById, id]);
  
  const handleUpdateStats = async () => {
    try {
      await updatePlayerStats(id);
      
      // Refresh player data
      const updatedPlayer = await getPlayerById(id);
      setPlayer(updatedPlayer);
      
      toast({
        title: 'Stats Updated',
        description: 'Player stats have been successfully updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
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
  
  const handleUpdateImage = async () => {
    if (!imageUrl) {
      toast({
        title: 'Error',
        description: 'Please enter an image URL',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsUpdatingImage(true);
    
    try {
      await updatePlayerImage(id, imageUrl);
      
      // Refresh player data
      const updatedPlayer = await getPlayerById(id);
      setPlayer(updatedPlayer);
      setImageUrl('');
      
      toast({
        title: 'Image Updated',
        description: 'Player image has been successfully updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update image',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUpdatingImage(false);
    }
  };
  
  if (loading && !player) {
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
        <Heading size="md" color="red.400" mb={2}>Error Loading Player</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  if (!player) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400">Player Not Found</Heading>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={4}>
          <Avatar 
            size="xl" 
            name={player.name} 
            src={player.imageUrl} 
            bg="gray.700"
          />
          <Box>
            <Heading color="white">{player.name}</Heading>
            <Flex gap={2} mt={2}>
              <Badge colorScheme={
                player.position === 'TOP' ? 'red' :
                player.position === 'JUNGLE' ? 'green' :
                player.position === 'MID' ? 'purple' :
                player.position === 'ADC' ? 'orange' :
                'blue'
              } fontSize="md" px={2} py={1}>
                {player.position}
              </Badge>
              <Badge colorScheme={player.region === 'NORTH' ? 'cyan' : 'yellow'} fontSize="md" px={2} py={1}>
                {player.region}
              </Badge>
              <Text fontWeight="medium" color="gray.300">{player.team}</Text>
            </Flex>
          </Box>
        </HStack>
        
        <Button 
          colorScheme="yellow" 
          onClick={handleUpdateStats}
          isLoading={loading}
        >
          Update Stats
        </Button>
      </Flex>
      
      <Box bg="gray.800" p={4} rounded="md" mb={6} borderWidth={1} borderColor="gray.700">
        <Heading size="sm" mb={3} color="white">Update Player Image</Heading>
        <InputGroup size="md">
          <Input
            placeholder="Enter image URL..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            bg="gray.700"
            borderColor="gray.600"
            pr="4.5rem"
            color="white"
          />
          <InputRightElement width="4.5rem">
            <Button 
              h="1.75rem" 
              size="sm" 
              colorScheme="yellow"
              onClick={handleUpdateImage}
              isLoading={isUpdatingImage}
            >
              Update
            </Button>
          </InputRightElement>
        </InputGroup>
      </Box>
      
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Fantasy Points</StatLabel>
          <StatNumber color="teal.300">{player.fantasyPoints.toFixed(1)}</StatNumber>
          <StatHelpText color="gray.400">
            {player.stats.gamesPlayed > 0
              ? `${(player.fantasyPoints / player.stats.gamesPlayed).toFixed(1)} per game`
              : 'No games played'}
          </StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">KDA Ratio</StatLabel>
          <StatNumber color="teal.300">
            {player.stats.deaths > 0
              ? ((player.stats.kills + player.stats.assists) / player.stats.deaths).toFixed(2)
              : 'Perfect'}
          </StatNumber>
          <StatHelpText color="gray.400">
            {player.stats.kills} / {player.stats.deaths} / {player.stats.assists}
          </StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Games Played</StatLabel>
          <StatNumber color="teal.300">{player.stats.gamesPlayed}</StatNumber>
          <StatHelpText color="gray.400">
            CS/Game: {
                player.stats.gamesPlayed > 0 
                ? Math.round(player.stats.cs / player.stats.gamesPlayed) 
                : 0}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
        
        <Box bg="gray.800" p={6} rounded="md" shadow="lg" mb={8} borderWidth={1} borderColor="gray.700">
          <Heading size="md" mb={4} color="white">Performance Stats</Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <Box>
              <Text mb={1} color="gray.300">Kills Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.kills / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="green" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.kills / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Deaths Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.deaths / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="red" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.deaths / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Assists Per Game</Text>
              <Flex align="center">
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.assists / player.stats.gamesPlayed) * 10 
                    : 0
                  } 
                  colorScheme="blue" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.assists / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
            </Box>
            
            <Box>
              <Text mb={1} color="gray.300">CS Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.cs / player.stats.gamesPlayed) / 4 
                    : 0
                  } 
                  colorScheme="orange" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? Math.round(player.stats.cs / player.stats.gamesPlayed) 
                    : '0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Vision Score Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.visionScore / player.stats.gamesPlayed) * 2 
                    : 0
                  } 
                  colorScheme="purple" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.visionScore / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Objective Kills Per Game</Text>
              <Flex align="center">
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? ((player.stats.baronKills + player.stats.dragonKills + player.stats.turretKills) / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="yellow" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? ((player.stats.baronKills + player.stats.dragonKills + player.stats.turretKills) / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
            </Box>
          </SimpleGrid>
          
          <Divider my={6} borderColor="gray.600" />
          
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat>
              <StatLabel color="gray.400">Total Kills</StatLabel>
              <StatNumber color="green.400">{player.stats.kills}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total Deaths</StatLabel>
              <StatNumber color="red.400">{player.stats.deaths}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total Assists</StatLabel>
              <StatNumber color="blue.400">{player.stats.assists}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total CS</StatLabel>
              <StatNumber color="orange.400">{player.stats.cs}</StatNumber>
            </Stat>
          </SimpleGrid>
        </Box>
      </Box>
    );
  };
  
  export default PlayerDetail;