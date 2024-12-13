import React,{useState} from 'react';
import axios from 'axios';
import {Input,Button,Card,Spin,Typography} from 'antd'
import {LoadingOutlined} from '@ant-design/icons'; //And Design loading icon
import './AIAssistant.css'; //CSS sytling

const {Title, Paragraph} = Typography

const AIAssistant = () => {
    // State to hold users query,AI response and loading state
    const [userQuery,setUserQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const[loading,setLoading] = useState(false)
    //Function to handle form sumission (sending the user query to the backend)
    const handleQuerySubmit = async () => {
        if (!userQuery.trim()) return; //no action taken if the query is empty

        setLoading(true); //starts loading 
        setAiResponse(''); // Clear previous response
        try{
            const response = await axios.post('http://localhost:50000/api/ai-assistant',{query: userQuery});
            setAiResponse(response.data.answer); //Sets AI response
        }catch (error){
            console.error("Error fetching AI response",error);
            setAiResponse("Sorry errors producing the current request")
        }finally{
            setLoading(false); //ends loading
        }
        }
        //Styling for AI processing the user query
        return (
            <div className='ai-page'>
                <Card title="Ask the AI about eco-friendly matierals,trends and your activity" className='ai-card'>
                    <Title level={3}>Ask a question:</Title>
                    <Input.TextArea
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Ask about ecofriendly tips and your activity..."
                    rows={4}
                    disable={loading} //Disable input when
                    />
                    <Button
                    type="primary"
                    onClick={handleQuerySubmit}
                    loading={loading}
                    style={{marginTop: '16px'}}
                    disabled={loading} 
                    >
                        Submit
                    </Button>
                    {loading && (
                        <Spin indicator={<LoadingOutlined style={{fontSize: 24}} spin />} style={{marginTop: '16px'}} />
                    )}
                    {aiResponse &&(
                        <div style={{marginTop: '20px'}}>
                            <Title level={4}>AI Response:</Title>
                            <Paragraph>{aiResponse}</Paragraph>
                        </div>
                    )}
                </Card>
            </div>
        )


    }
export default AIAssistant;