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
  const accentColor = isSelected ? "purple.400" : (userIsMember ? "teal.400" : "blue.400");
  const navigate = useNavigate();
  
  const handleClick = (e) => {
    e.preventDefault();
    if (userIsMember) {
      onSelect(league);
      navigate(`/leagues/${league.id}`);
    } else {
      onJoin(league.id);
    }
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
      <Flex justify="center" mt={5} gap={2}>
        {userIsMember ? (
          <Button 
            as={RouterLink}
            to={`/leagues/${league.id}`}
            size="sm" 
            width="full"
            colorScheme="teal" 
            variant="outline"
            leftIcon={<ViewIcon />}
          >
            View Details
          </Button>
        ) : (
          <Button 
            size="sm" 
            width="full"
            colorScheme="blue" 
            onClick={(e) => {
              e.stopPropagation();
              onJoin(league.id);
            }}
            leftIcon={<StarIcon />}
          >
            Join League
          </Button>
        )}
      </Flex>
      
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
  const [selectedRegions, setSelectedRegions] = useState(['LCS', 'LEC']);
  const { createLeague } = useApi();
  const toast = useToast();
  
  const regionOptions = [
    { value: 'LCS', label: 'North America (LCS)' },
    { value: 'LEC', label: 'Europe (LEC)' },
    { value: 'LCK', label: 'Korea (LCK)' },
    { value: 'LPL', label: 'China (LPL)' },
    { value: 'NORTH', label: 'LTA North' },
    { value: 'SOUTH', label: 'LTA South' },
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
      const newLeague = await createLeague({ 
        name, 
        description, 
        maxTeams: parseInt(maxTeams, 10) || 12, 
        isPublic,
        regions: selectedRegions
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
      setSelectedRegions(['LCS', 'LEC']);
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
            
            <FormControl mb={4}>
              <FormLabel fontWeight="bold">Regions</FormLabel>
              <FormHelperText color="gray.400" mb={2}>
                Select the regions whose players will be available in your league
              </FormHelperText>
              <CheckboxGroup 
                colorScheme="teal" 
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
              colorScheme="teal" 
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
  const [leagues, setLeagues] = useState([]);
  const [filteredLeagues, setFilteredLeagues] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();
  
  const { user } = useAuth();
  const { getLeagues, getUserLeagues, joinLeague } = useApi();
  const { selectLeague, selectedLeague, userLeagues, loading: leagueContextLoading } = useLeague();
  
  // Load leagues
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        setLoading(true);
        const allLeagues = await getLeagues();
        setLeagues(allLeagues);
        
        if (searchTerm) {
          filterLeagues(allLeagues, searchTerm);
        } else {
          setFilteredLeagues(allLeagues);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to load leagues:', error);
        toast({
          title: 'Error',
          description: 'Failed to load leagues',
          status: 'error',
          duration: 3000,
          position: 'top'
        });
        setLoading(false);
      }
    };
    
    loadLeagues();
  }, [getLeagues, toast, searchTerm]);
  
  // Filter leagues when search term changes
  const filterLeagues = (leagueList, term) => {
    if (!term) {
      setFilteredLeagues(leagueList);
      return;
    }
    
    const filtered = leagueList.filter(league => 
      league.name.toLowerCase().includes(term.toLowerCase()) || 
      (league.description && league.description.toLowerCase().includes(term.toLowerCase()))
    );
    
    setFilteredLeagues(filtered);
  };
  
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    filterLeagues(leagues, term);
  };
  
  const handleJoinLeague = async (leagueId) => {
    try {
      setJoining(true);
      await joinLeague(leagueId);
      
      // Reload leagues after joining
      const updatedUserLeagues = await getUserLeagues();
      
      toast({
        title: 'Success',
        description: 'You have joined the league',
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      // Reload all leagues to update UI
      const allLeagues = await getLeagues();
      setLeagues(allLeagues);
      filterLeagues(allLeagues, searchTerm);
      
      setJoining(false);
    } catch (error) {
      console.error('Failed to join league:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
      setJoining(false);
    }
  };
  
  const handleLeagueCreated = (newLeague) => {
    setLeagues(prevLeagues => [...prevLeagues, newLeague]);
    setFilteredLeagues(prevLeagues => [...prevLeagues, newLeague]);
  };
  
  const handleSelectLeague = (league) => {
    selectLeague(league);
    toast({
      title: 'League Selected',
      description: `${league.name} is now your active league`,
      status: 'success',
      duration: 2000,
      position: 'top-right'
    });
  };
  
  // Separate leagues into user's leagues and public leagues
  const userMemberLeagues = filteredLeagues.filter(league => 
    league.memberIds && league.memberIds.includes(user?.id)
  );
  
  const publicLeagues = filteredLeagues.filter(league => 
    league.isPublic && (!league.memberIds || !league.memberIds.includes(user?.id))
  );
  
  // Loading state
  if (loading || leagueContextLoading) {
    return (
      <Flex justify="center" align="center" h="50vh" direction="column">
        <Spinner size="xl" color="teal.400" thickness="4px" mb={4} />
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
            value={searchTerm}
            onChange={handleSearch}
            bg="gray.700"
            border="none"
            width={{ base: "full", md: "auto" }}
          />
          <Button
            leftIcon={<AddIcon />}
            colorScheme="teal"
            onClick={onOpen}
          >
            Create League
          </Button>
        </Flex>
      </Flex>

      {/* User's Member Leagues Section */}
      <Box mb={10}>
        <Heading size="md" mb={4} color="teal.400">
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
                onSelect={handleSelectLeague}
                isSelected={selectedLeague && selectedLeague.id === league.id}
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
                onSelect={handleSelectLeague}
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
    </Box>
  );
};

export default Leagues;