import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Heading, SimpleGrid, Text, Button, Flex,
  Link, Spinner, useDisclosure, Modal,
  ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, FormControl, FormLabel, Input,
  useToast, ModalFooter, Switch, FormHelperText, Tabs, TabList, Tab, TabPanels, TabPanel,
  VStack, Icon, Grid, GridItem, Menu, MenuButton, MenuList, MenuItem
} from '@chakra-ui/react';
import { AddIcon, StarIcon, ViewIcon, LockIcon, UnlockIcon, CheckIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

const LeagueCard = ({ league, onJoin, userIsMember, onSelect, isSelected }) => {
  const cardBg = "gray.800";
  const cardHoverBg = "gray.700";
  const accentColor = isSelected ? "purple.400" : (userIsMember ? "teal.400" : "blue.400");
  const navigate = useNavigate();
  
  const handleSelect = (e) => {
    e.preventDefault();
    onSelect(league);
  };
  
  return (
    <Box
      bg={cardBg}
      p={6}
      rounded="lg"
      shadow="xl"
      borderWidth={1}
      borderColor={isSelected ? "purple.400" : "gray.700"}
      transition="all 0.3s"
      _hover={{ 
        transform: 'translateY(-4px)', 
        shadow: '2xl',
        bg: cardHoverBg,
        borderColor: accentColor
      }}
      position="relative"
      overflow="hidden"
    >
      {/* Visual accent element */}
      <Box 
        position="absolute" 
        top={0} 
        left={0} 
        right={0} 
        height="4px" 
        bg={accentColor} 
      />
      
      {/* League info */}
      <Flex justify="space-between" align="flex-start" mb={4}>
        <Heading size="md" fontWeight="extrabold" mb={2} mt={2}>
          <Link as={RouterLink} to={`/leagues/${league.id}`} color="white" _hover={{ color: accentColor }}>
            {league.name}
          </Link>
        </Heading>
        <Icon 
          as={league.isPublic ? UnlockIcon : LockIcon} 
          color={league.isPublic ? "green.400" : "orange.400"}
        />
      </Flex>
      
      <Text color="gray.400" fontSize="sm" mb={4} noOfLines={2}>
        {league.description || 'No description available'}
      </Text>
      
      {/* Stats */}
      <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
        <GridItem>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="xs" color="gray.500">Members</Text>
            <Text fontWeight="bold" fontSize="lg">{league.memberIds?.length || 0}</Text>
          </VStack>
        </GridItem>
        <GridItem>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="xs" color="gray.500">Teams</Text>
            <Text fontWeight="bold" fontSize="lg">{league.teams?.length || 0}</Text>
          </VStack>
        </GridItem>
      </Grid>
      
      {/* Action buttons */}
      <Flex justify="center" mt={5} gap={2}>
        {userIsMember ? (
          <>
            <Button 
              as={RouterLink}
              to={`/leagues/${league.id}`}
              size="sm" 
              width="full"
              colorScheme="teal" 
              variant="outline"
              leftIcon={<ViewIcon />}
            >
              View
            </Button>
            {isSelected ? (
              <Button
                size="sm"
                colorScheme="purple"
                leftIcon={<CheckIcon />}
                isDisabled
              >
                Active
              </Button>
            ) : (
              <Button
                size="sm"
                colorScheme="purple"
                variant="outline"
                onClick={handleSelect}
              >
                Select
              </Button>
            )}
          </>
        ) : (
          <Button 
            size="sm" 
            width="full"
            colorScheme="blue" 
            onClick={() => onJoin(league.id)}
            leftIcon={<StarIcon />}
          >
            Join League
          </Button>
        )}
      </Flex>
    </Box>
  );
};

const CreateLeagueModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxTeams, setMaxTeams] = useState(12);
  const [isPublic, setIsPublic] = useState(true);
  const { createLeague, loading } = useApi();
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: 'Missing Field',
        description: 'Please enter a league name',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      const newLeague = await createLeague({ 
        name, 
        description, 
        maxTeams, 
        isPublic 
      });
      
      toast({
        title: 'League Created',
        description: `${name} has been created successfully`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      setName('');
      setDescription('');
      setMaxTeams(12);
      setIsPublic(true);
      onClose();
      onCreate(newLeague);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="gray.800" color="white" borderRadius="lg">
        <ModalHeader borderBottomWidth="1px" borderColor="gray.700">Create New League</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody py={6}>
            <FormControl mb={4} isRequired>
              <FormLabel fontWeight="bold">League Name</FormLabel>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter league name"
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "teal.300" }}
                _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">Description</FormLabel>
              <Input 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your league"
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "teal.300" }}
                _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">Maximum Teams</FormLabel>
              <Input 
                type="number"
                value={maxTeams}
                onChange={(e) => setMaxTeams(parseInt(e.target.value))}
                min={2}
                max={20}
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "teal.300" }}
                _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">League Visibility</FormLabel>
              <Flex align="center">
                <Switch 
                  isChecked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)}
                  colorScheme="teal"
                  size="lg"
                  mr={3}
                />
                <Text>{isPublic ? "Public" : "Private"}</Text>
              </Flex>
              <FormHelperText color="gray.400">
                {isPublic ? "Anyone can see and join your league" : "Only people you invite can join your league"}
              </FormHelperText>
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} _hover={{ bg: "whiteAlpha.100" }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              colorScheme="teal" 
              isLoading={loading}
              leftIcon={<AddIcon />}
            >
              Create League
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const EmptyState = ({ title, description, buttonText, buttonIcon, onClick }) => {
  return (
    <Box 
      p={8} 
      bg="gray.800" 
      rounded="lg" 
      textAlign="center"
      borderWidth="1px"
      borderColor="gray.700"
      shadow="xl"
    >
      <Icon as={buttonIcon} boxSize={12} color="gray.400" mb={4} />
      <Heading size="md" mb={2} fontWeight="bold" color="white">{title}</Heading>
      <Text color="gray.300" mb={6}>{description}</Text>
      <Button 
        colorScheme="teal" 
        onClick={onClick}
        size="lg"
        leftIcon={<AddIcon />}
      >
        {buttonText}
      </Button>
    </Box>
  );
};

const Leagues = () => {
  const { getLeagues, getUserLeagues, joinLeague, loading, error } = useApi();
  const [allLeagues, setAllLeagues] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { selectedLeague, selectLeague } = useLeague();
  const toast = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const [allLeaguesData, userLeaguesData] = await Promise.all([
          getLeagues(),
          getUserLeagues()
        ]);
        
        setAllLeagues(allLeaguesData);
        setUserLeagues(userLeaguesData);
      } catch (error) {
        console.error('Error fetching leagues:', error);
      }
    };
    
    fetchLeagues();
  }, [getLeagues, getUserLeagues]);
  
  const handleJoinLeague = async (leagueId) => {
    try {
      await joinLeague(leagueId);
      
      // Refresh leagues
      const userLeaguesData = await getUserLeagues();
      setUserLeagues(userLeaguesData);
      
      toast({
        title: 'Success!',
        description: 'You have successfully joined the league',
        status: 'success',
        duration: 3000,
        position: 'top'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  const handleLeagueCreated = (newLeague) => {
    setAllLeagues(prev => [...prev, newLeague]);
    setUserLeagues(prev => [...prev, newLeague]);
  };
  
  const handleSelectLeague = (league) => {
    selectLeague(league);
    
    // Show notification
    toast({
      title: 'League Selected',
      description: `${league.name} is now your active league`,
      status: 'success',
      duration: 3000,
      position: 'top'
    });
  };
  
  const isLeagueSelected = (league) => {
    return selectedLeague && selectedLeague._id === league.id;
  };
  
  if (loading && allLeagues.length === 0 && userLeagues.length === 0) {
    return (
      <Flex justify="center" align="center" height="50vh">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="teal.500"
          size="xl"
        />
      </Flex>
    );
  }
  
  if (error) {
    return (
      <Box p={6} bg="red.900" rounded="md" borderWidth={1} borderColor="red.700">
        <Heading size="md" color="red.300" mb={2}>Error Loading Leagues</Heading>
        <Text color="white">{error}</Text>
      </Box>
    );
  }
  
  const userLeagueIds = userLeagues.map(league => league.id);
  
  return (
    <Box>
      <Flex 
        justify="space-between" 
        align="center" 
        mb={8}
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 4, md: 0 }}
      >
        <Box>
          <Heading size="2xl" fontWeight="extrabold" mb={2} color="white">My Leagues</Heading>
          <Text color="gray.300">Manage your fantasy leagues and teams</Text>
        </Box>
        <Button 
          colorScheme="teal" 
          onClick={onOpen} 
          size="lg"
          leftIcon={<AddIcon />}
          shadow="md"
        >
          Create League
        </Button>
      </Flex>
      
      <Tabs 
        variant="soft-rounded" 
        colorScheme="teal" 
        mb={6}
        isLazy
      >
        <TabList mb={8}>
          <Tab _selected={{ color: 'white', bg: 'teal.500' }}>
            My Leagues ({userLeagues.length})
          </Tab>
          <Tab _selected={{ color: 'white', bg: 'teal.500' }}>
            Discover Leagues
          </Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel px={0}>
            {userLeagues.length > 0 ? (
              <SimpleGrid 
                columns={{ base: 1, md: 2, lg: 3 }} 
                spacing={8}
              >
                {userLeagues.map(league => (
                  <LeagueCard 
                    key={league.id} 
                    league={league} 
                    userIsMember={true}
                    onSelect={handleSelectLeague}
                    isSelected={isLeagueSelected(league)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <EmptyState 
                title="No Leagues Yet"
                description="Create your first league to start drafting players and competing with friends"
                buttonText="Create Your First League"
                buttonIcon={AddIcon}
                onClick={onOpen}
              />
            )}
          </TabPanel>
          
          <TabPanel px={0}>
            {allLeagues.filter(l => l.isPublic).length > 0 ? (
              <SimpleGrid 
                columns={{ base: 1, md: 2, lg: 3 }} 
                spacing={8}
              >
                {allLeagues
                  .filter(league => league.isPublic || league.creatorId === null)
                  .map(league => (
                    <LeagueCard 
                      key={league.id} 
                      league={league} 
                      onJoin={handleJoinLeague}
                      userIsMember={userLeagueIds.includes(league.id)}
                      onSelect={handleSelectLeague}
                      isSelected={isLeagueSelected(league)}
                    />
                  ))
                }
              </SimpleGrid>
            ) : (
              <EmptyState 
                title="No Public Leagues Available"
                description="Create your own league and invite friends to join"
                buttonText="Create New League"
                buttonIcon={AddIcon}
                onClick={onOpen}
              />
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      
      <CreateLeagueModal 
        isOpen={isOpen} 
        onClose={onClose} 
        onCreate={handleLeagueCreated} 
      />
    </Box>
  );
};

export default Leagues;