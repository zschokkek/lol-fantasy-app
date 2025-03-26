import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Heading, SimpleGrid, Text, Button, Flex,
  Link, Spinner, useDisclosure, Modal,
  ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, FormControl, FormLabel, Input,
  useToast, ModalFooter, Switch, FormHelperText, Tabs, TabList, Tab, TabPanels, TabPanel,
  VStack, Icon, Grid, GridItem, Menu, MenuButton, MenuList, MenuItem, Select, Checkbox, CheckboxGroup
} from '@chakra-ui/react';
import { AddIcon, StarIcon, ViewIcon, LockIcon, UnlockIcon, CheckIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

const LeagueCard = ({ league, onJoin, userIsMember, onSelect, isSelected }) => {
  const cardBg = "gray.800";
  const cardHoverBg = "gray.700";
  const accentColor = isSelected ? "purple.400" : (userIsMember ? "yellow.400" : "blue.400");
  const navigate = useNavigate();
  
  const handleClick = (e) => {
    e.preventDefault();
    onSelect(league);
    navigate(`/leagues/${league.id}`);
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
      onClick={handleClick}
      cursor="pointer"
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
          {league.name}
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
      {/* <Flex justify="center" mt={5} gap={2}>
        <Button 
          as={RouterLink}
          to={`/leagues/${league.id}`}
          size="sm" 
          width="full"
          colorScheme={userIsMember ? "teal" : "blue"} 
          variant="outline"
          leftIcon={<ViewIcon />}
        >
          View Details
        </Button>
      </Flex> */}
      
      {isSelected && (
        <Box 
          position="absolute" 
          bottom={2} 
          right={2} 
          bg="purple.400" 
          color="white" 
          p={1} 
          rounded="full" 
          fontSize="xs"
        >
          <CheckIcon />
        </Box>
      )}
    </Box>
  );
};

const CreateLeagueModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxTeams, setMaxTeams] = useState(12);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const { createLeague } = useApi();
  const toast = useToast();
  
  const regionOptions = [
    { value: 'AMERICAS', label: 'Americas' },
    { value: 'EMEA', label: 'Europe, Middle East & Africa' },
    { value: 'CHINA', label: 'China' },
    { value: 'KOREA', label: 'Korea' },
  ];
  
  const handleRegionChange = (selectedValues) => {
    setSelectedRegions(selectedValues);
  };
  
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
    
    if (selectedRegions.length === 0) {
      toast({
        title: 'Missing Field',
        description: 'Please select at least one region',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.log('Creating league with data:', { name, description, maxTeams, isPublic, regions: selectedRegions });
      const newLeague = await createLeague({ 
        name, 
        description, 
        maxTeams: parseInt(maxTeams, 10) || 12, 
        isPublic,
        regions: selectedRegions
      });
      
      console.log('League created successfully:', newLeague);
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
      setSelectedRegions([]);
      onClose();
      
      if (newLeague) {
        onCreate(newLeague);
      }
    } catch (error) {
      console.error('Error creating league:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    } finally {
      setIsSubmitting(false);
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
                _hover={{ borderColor: "yellow.300" }}
                _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
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
                _hover={{ borderColor: "yellow.300" }}
                _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
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
                _hover={{ borderColor: "yellow.300" }}
                _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
              />
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">League Visibility</FormLabel>
              <Flex align="center">
                <Switch 
                  isChecked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)}
                  colorScheme="yellow"
                  size="lg"
                  mr={3}
                />
                <Text>{isPublic ? "Public" : "Private"}</Text>
              </Flex>
              <FormHelperText color="gray.400">
                {isPublic ? "Anyone can see and join your league" : "Only people you invite can join your league"}
              </FormHelperText>
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">Regions</FormLabel>
              <FormHelperText color="gray.400" mb={2}>
                Select the regions whose players will be available in your league
              </FormHelperText>
              <CheckboxGroup 
                colorScheme="yellow" 
                value={selectedRegions} 
                onChange={handleRegionChange}
              >
                <VStack align="start" spacing={2}>
                  {regionOptions.map(option => (
                    <Checkbox key={option.value} value={option.value}>
                      {option.label}
                    </Checkbox>
                  ))}
                </VStack>
              </CheckboxGroup>
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} _hover={{ bg: "whiteAlpha.100" }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              colorScheme="yellow" 
              isLoading={isSubmitting}
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
        colorScheme="yellow" 
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
  const [leagues, setLeagues] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { getLeagues, getUserLeagues } = useApi();
  const { user } = useAuth();
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newLeagueId, setNewLeagueId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchLeagues();
  }, [refreshTrigger]);

  const fetchLeagues = async () => {
    try {
      console.log('Fetching leagues...');
      setLoading(true);
      const allLeagues = await getLeagues();
      console.log('All leagues:', allLeagues);
      setLeagues(allLeagues);
      
      if (user && user.id) {
        const myLeagues = await getUserLeagues();
        console.log('User leagues:', myLeagues);
        setUserLeagues(myLeagues);
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle league creation completion
  const handleLeagueCreated = (newLeague) => {
    console.log('League created:', newLeague);
    // Refresh the leagues list
    setRefreshTrigger(prev => prev + 1);
    
    // If the backend suggested we prompt for team creation
    if (newLeague.promptCreateTeam) {
      setNewLeagueId(newLeague.id);
      setShowCreateTeamModal(true);
    }
  };
  
  // Handle team creation completion
  const handleTeamCreated = () => {
    console.log('Team created in league:', newLeagueId);
    setShowCreateTeamModal(false);
    setNewLeagueId(null);
    // Refresh the leagues list again to show new team
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    const filtered = leagues.filter(league => 
      league.name.toLowerCase().includes(term.toLowerCase()) || 
      (league.description && league.description.toLowerCase().includes(term.toLowerCase()))
    );
    
    setLeagues(filtered);
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      const updatedUserLeagues = await getUserLeagues();
      
      console.log('User leagues:', updatedUserLeagues);
      
      setUserLeagues(updatedUserLeagues);
    } catch (error) {
      console.error('Failed to join league:', error);
    }
  };

  // Separate leagues into user's leagues and public leagues
  const userMemberLeagues = leagues.filter(league => {
    // Filter out leagues where user is a member (and handle null values)
    if (!league.memberIds) return false;
    return league.memberIds.some(id => id === user?.id);
  });
  
  const publicLeagues = leagues.filter(league => {
    // Include only public leagues where the user is not a member
    if (!league.isPublic) return false;
    
    // If memberIds is missing, consider it not a member
    if (!league.memberIds) return true;
    
    // Filter out null values and check if user is not in the memberIds list
    return !league.memberIds.some(id => id === user?.id);
  });

  // Loading state
  if (loading) {
    return (
      <Flex justify="center" align="center" h="50vh" direction="column">
        <Spinner size="xl" color="yellow.400" thickness="4px" mb={4} />
        <Text color="gray.400">Loading leagues...</Text>
      </Flex>
    );
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Heading size="xl" fontWeight="extrabold">
          My Leagues
        </Heading>
        <Flex gap={4}>
          <Input
            placeholder="Search leagues..."
            onChange={handleSearch}
            bg="gray.700"
            border="none"
            width={{ base: "full", md: "auto" }}
          />
          <Button
            leftIcon={<AddIcon />}
            colorScheme="yellow"
            onClick={onOpen}
          >
            Create League
          </Button>
        </Flex>
      </Flex>

      {/* User's Member Leagues Section */}
      <Box mb={10}>
        <Heading size="md" mb={4} color="yellow.400">
          My Leagues
        </Heading>
        
        {userMemberLeagues.length === 0 ? (
          <EmptyState 
            title="No Leagues Found" 
            description="You are not a member of any leagues yet. Join an existing league or create your own!"
            buttonText="Create a League"
            buttonIcon={AddIcon}
            onClick={onOpen}
          />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6}>
            {userMemberLeagues.map(league => (
              <LeagueCard
                key={league.id}
                league={league}
                onJoin={handleJoinLeague}
                userIsMember={league.memberIds && league.memberIds.includes(user?.id)}
                onSelect={() => {}}
                isSelected={false}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
      
      {/* Public Leagues Section */}
      <Box>
        <Heading size="md" mb={4} color="blue.400">
          Public Leagues
        </Heading>
        
        {publicLeagues.length === 0 ? (
          <Box 
            p={8} 
            bg="gray.800" 
            borderRadius="lg" 
            textAlign="center"
          >
            <Text color="gray.400">No public leagues are available to join at this time.</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6}>
            {publicLeagues.map(league => (
              <LeagueCard
                key={league.id}
                league={league}
                onJoin={handleJoinLeague}
                userIsMember={false}
                onSelect={() => {}}
                isSelected={false}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* Create League Modal */}
      <CreateLeagueModal 
        isOpen={isOpen} 
        onClose={onClose} 
        onCreate={handleLeagueCreated} 
      />
      
      {/* Create Team Modal for new league */}
      {showCreateTeamModal && newLeagueId && (
        <CreateTeamForLeagueModal
          isOpen={showCreateTeamModal}
          onClose={() => setShowCreateTeamModal(false)}
          leagueId={newLeagueId}
          onTeamCreated={handleTeamCreated}
        />
      )}
    </Box>
  );
};

// Modal to create a team for a new league
const CreateTeamForLeagueModal = ({ isOpen, onClose, leagueId, onTeamCreated }) => {
  const [teamName, setTeamName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createTeam } = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!teamName) {
      toast({
        title: 'Missing Field',
        description: 'Please enter a team name',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      console.log('Creating team in league:', leagueId);
      
      const newTeam = await createTeam({ 
        name: teamName, 
        owner: user.username,
        leagueId: leagueId
      });
      
      console.log('Team created successfully:', newTeam);
      
      toast({
        title: 'Team Created',
        description: `${teamName} has been created successfully`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      setTeamName('');
      onClose();
      
      if (onTeamCreated) {
        onTeamCreated(newTeam);
      }
      
      // Navigate to the league detail page
      navigate(`/leagues/${leagueId}`);
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="gray.800" color="white" borderRadius="lg">
        <ModalHeader borderBottomWidth="1px" borderColor="gray.700">Create Your Team</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody py={6}>
            <Text mb={4} color="gray.400">
              Your league has been created! Now, let's create your team in this league.
            </Text>
            
            <FormControl mb={4} isRequired>
              <FormLabel fontWeight="bold">Team Name</FormLabel>
              <Input 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter a cool team name"
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "yellow.300" }}
                _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} _hover={{ bg: "whiteAlpha.100" }}>
              Skip
            </Button>
            <Button 
              type="submit" 
              colorScheme="yellow" 
              isLoading={isSubmitting}
              leftIcon={<AddIcon />}
            >
              Create Team
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default Leagues;